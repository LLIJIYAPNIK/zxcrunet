"""DNS lookups (dnspython) and the HTTPS probe (a plain TLS handshake on port 443)."""

import asyncio
import ssl
from contextlib import suppress

import dns.asyncresolver
import dns.exception
import dns.rdatatype
import dns.resolver

from zxcrunet.domains.domain.domain import DnsRecords, Hostname


class _DnsUnavailableError(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class DnsPythonResolver:
    def __init__(self, nameservers: list[str], timeout_seconds: float) -> None:
        # Our own nameservers avoid stale answers cached by the host's resolver.
        self._resolver = dns.asyncresolver.Resolver(configure=not nameservers)
        if nameservers:
            self._resolver.nameservers = list(nameservers)
        self._resolver.lifetime = timeout_seconds

    async def lookup(self, host: Hostname) -> DnsRecords:
        try:
            txt, a, aaaa = await asyncio.gather(
                self._query(host.verify_name, dns.rdatatype.TXT),
                self._query(host.value, dns.rdatatype.A),
                self._query(host.value, dns.rdatatype.AAAA),
            )
        except _DnsUnavailableError as exc:
            return DnsRecords(error=exc.reason)
        return DnsRecords(txt=txt, a=a, aaaa=aaaa)

    async def _query(self, name: str, rdtype: dns.rdatatype.RdataType) -> tuple[str, ...]:
        try:
            answer = await self._resolver.resolve(name, rdtype, search=False)
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
            return ()
        except dns.exception.Timeout as exc:
            raise _DnsUnavailableError("timeout") from exc
        except dns.exception.DNSException as exc:
            raise _DnsUnavailableError("servfail") from exc
        if rdtype == dns.rdatatype.TXT:
            return tuple(b"".join(r.strings).decode("utf-8", "replace") for r in answer)
        return tuple(r.address for r in answer)


class HandshakeTlsProbe:
    """Valid certificate ⇔ a TLS handshake with SNI succeeds (and, by default, verifies)."""

    def __init__(self, timeout_seconds: float, *, verify: bool = True) -> None:
        self._timeout = timeout_seconds
        self._context = ssl.create_default_context()
        if not verify:  # dev: Caddy's internal CA is not trusted by the system
            self._context.check_hostname = False
            self._context.verify_mode = ssl.CERT_NONE

    async def has_certificate(self, host: Hostname) -> bool:
        try:
            async with asyncio.timeout(self._timeout):
                _, writer = await asyncio.open_connection(
                    host.value, 443, ssl=self._context, server_hostname=host.value
                )
        except (OSError, TimeoutError):  # ssl.SSLError is an OSError
            return False
        writer.close()
        with suppress(OSError):
            await writer.wait_closed()
        return True
