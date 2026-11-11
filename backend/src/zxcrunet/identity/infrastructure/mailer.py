from email.message import EmailMessage as MimeMessage
from typing import Protocol

import aiosmtplib

from zxcrunet.identity.application.ports import EmailMessage
from zxcrunet.shared.config import Settings


class SmtpEmailSender:
    """Sends a message right away. Used by the background worker."""

    def __init__(self, settings: Settings) -> None:
        self._s = settings

    async def send(self, message: EmailMessage) -> None:
        mime = MimeMessage()
        mime["From"] = self._s.mail_from
        mime["To"] = message.to
        mime["Subject"] = message.subject
        mime.set_content(message.text)
        await aiosmtplib.send(
            mime,
            hostname=self._s.smtp_host,
            port=self._s.smtp_port,
            username=self._s.smtp_username,
            password=self._s.smtp_password,
            start_tls=self._s.smtp_start_tls,
        )


class EmailTask(Protocol):
    async def kiq(self, to: str, subject: str, text: str) -> object: ...


class QueuedMailer:
    """Puts the message on the Taskiq queue; the worker delivers it over SMTP."""

    def __init__(self, task: EmailTask) -> None:
        self._task = task

    async def send(self, message: EmailMessage) -> None:
        await self._task.kiq(message.to, message.subject, message.text)
