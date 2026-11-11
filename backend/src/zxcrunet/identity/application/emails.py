"""Texts of transactional emails (Russian)."""

from urllib.parse import urlencode

from zxcrunet.identity.application.ports import EmailMessage


class EmailTemplates:
    def __init__(self, public_url: str) -> None:
        self._base = public_url.rstrip("/")

    def _link(self, path: str, token: str) -> str:
        return f"{self._base}{path}?{urlencode({'token': token})}"

    def verify_email(self, to: str, token: str, ttl_hours: int) -> EmailMessage:
        link = self._link("/app/verify-email", token)
        return EmailMessage(
            to=to,
            subject="Подтвердите почту в zxcrunet",
            text=(
                "Здравствуйте!\n\n"
                "Чтобы подтвердить почту для zxcrunet, откройте ссылку:\n"
                f"{link}\n\n"
                f"Ссылка действует {ttl_hours} ч. Если вы не регистрировались, "
                "просто проигнорируйте письмо.\n\n"
                "— zxcrunet"
            ),
        )

    def reset_password(self, to: str, token: str, ttl_minutes: int) -> EmailMessage:
        link = self._link("/app/reset-password", token)
        return EmailMessage(
            to=to,
            subject="Сброс пароля в zxcrunet",
            text=(
                "Здравствуйте!\n\n"
                "Кто-то запросил сброс пароля для вашего аккаунта zxcrunet. "
                "Чтобы задать новый пароль, откройте ссылку:\n"
                f"{link}\n\n"
                f"Ссылка действует {ttl_minutes} мин. Если это были не вы, "
                "ничего делать не нужно: пароль останется прежним.\n\n"
                "— zxcrunet"
            ),
        )
