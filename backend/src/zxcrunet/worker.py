"""Taskiq background worker and scheduler.

- `taskiq worker zxcrunet.worker:broker` runs the tasks;
- `taskiq scheduler zxcrunet.worker:scheduler` puts periodic tasks on the queue.
"""

from uuid import UUID

from dishka import AsyncContainer
from taskiq import TaskiqEvents, TaskiqScheduler, TaskiqState
from taskiq.schedule_sources import LabelScheduleSource
from taskiq_redis import ListQueueBroker

from zxcrunet.identity.application.ports import EmailMessage
from zxcrunet.identity.infrastructure.mailer import SmtpEmailSender
from zxcrunet.shared.config import Settings

settings = Settings()
# No read timeout: the worker waits on BRPOP for as long as the queue is empty
# (redis-py 8 defaults to 5 seconds and the worker processes would crash on an idle queue).
broker = ListQueueBroker(settings.redis_url, queue_name="zxcrunet", socket_timeout=None)
scheduler = TaskiqScheduler(broker, sources=[LabelScheduleSource(broker)])

_container: AsyncContainer | None = None


@broker.on_event(TaskiqEvents.WORKER_STARTUP)
async def _startup(_: TaskiqState) -> None:
    global _container  # noqa: PLW0603 — one DI container per worker process
    from zxcrunet.main import make_container  # noqa: PLC0415 — main imports this module

    _container = make_container(settings)


@broker.on_event(TaskiqEvents.WORKER_SHUTDOWN)
async def _shutdown(_: TaskiqState) -> None:
    if _container is not None:
        await _container.close()


def _app() -> AsyncContainer:
    if _container is None:
        msg = "The DI container is created when the worker starts"
        raise RuntimeError(msg)
    return _container


@broker.task(task_name="send_email", retry_on_error=True, max_retries=5)
async def send_email(to: str, subject: str, text: str) -> None:
    await SmtpEmailSender(settings).send(EmailMessage(to=to, subject=subject, text=text))


@broker.task(task_name="check_domain")
async def check_domain(domain_id: str) -> None:
    """DNS check of one custom domain (and the certificate probe once it is verified)."""
    from zxcrunet.domains.application.use_cases import CheckDomain  # noqa: PLC0415

    async with _app()() as request:
        use_case = await request.get(CheckDomain)
        await use_case(UUID(domain_id))


@broker.task(task_name="check_due_domains", schedule=[{"cron": "* * * * *"}])
async def check_due_domains() -> None:
    """Every minute: queue the checks whose time has come (backoff, daily re-checks)."""
    from zxcrunet.domains.application.use_cases import DueDomains  # noqa: PLC0415

    async with _app()() as request:
        due = await (await request.get(DueDomains))()
    for domain_id in due:
        await check_domain.kiq(str(domain_id))
