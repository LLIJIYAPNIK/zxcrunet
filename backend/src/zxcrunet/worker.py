"""Taskiq background worker: `taskiq worker zxcrunet.worker:broker`."""

from taskiq_redis import ListQueueBroker

from zxcrunet.identity.application.ports import EmailMessage
from zxcrunet.identity.infrastructure.mailer import SmtpEmailSender
from zxcrunet.shared.config import Settings

settings = Settings()
broker = ListQueueBroker(settings.redis_url, queue_name="zxcrunet")


@broker.task(task_name="send_email", retry_on_error=True, max_retries=5)
async def send_email(to: str, subject: str, text: str) -> None:
    await SmtpEmailSender(settings).send(EmailMessage(to=to, subject=subject, text=text))
