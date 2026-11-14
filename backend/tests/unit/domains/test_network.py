"""The dnspython adapter on a stubbed resolver: no network, real answer types and errors."""

from typing import Any, cast

import dns.exception
import dns.message
import dns.name
import dns.rdataclass
import dns.rdatatype
import dns.resolver
import pytest

from zxcrunet.domains.domain.domain import DnsRecords, Hostname
from zxcrunet.domains.infrastructure.network import DnsPythonResolver, HandshakeTlsProbe

HOST = Hostname("example.com")


def answer(name: str, rdtype: dns.rdatatype.RdataType, *values: str) -> dns.resolver.Answer:
    query = dns.message.make_query(name, rdtype)
    response = dns.message.make_response(query)
    rrset = response.find_rrset(
        response.answer, dns.name.from_text(name), dns.rdataclass.IN, rdtype, create=True
    )
    for value in values:
        rrset.add(dns.rdata.from_text(dns.rdataclass.IN, rdtype, value), ttl=300)
    query_response = cast(dns.message.QueryMessage, response)
    return dns.resolver.Answer(dns.name.from_text(name), rdtype, dns.rdataclass.IN, query_response)


def error(kind: type[Exception], **kwargs: Any) -> Exception:
    """dnspython's exceptions are untyped: build them through a typed call."""
    return kind(**kwargs)


def stub(
    monkeypatch: pytest.MonkeyPatch,
    resolver: DnsPythonResolver,
    table: dict[tuple[str, str], Any],
) -> None:
    async def resolve(name: str, rdtype: dns.rdatatype.RdataType, **_: object) -> Any:
        result = table.get((name, dns.rdatatype.to_text(rdtype)))
        if isinstance(result, Exception):
            raise result
        if result is None:
            raise error(dns.resolver.NoAnswer)
        return result

    monkeypatch.setattr(resolver._resolver, "resolve", resolve)


async def test_reads_txt_a_and_aaaa(monkeypatch: pytest.MonkeyPatch) -> None:
    resolver = DnsPythonResolver(["192.0.2.53"], 1.0)
    stub(
        monkeypatch,
        resolver,
        {
            ("_zxc-verify.example.com", "TXT"): answer(
                "_zxc-verify.example.com", dns.rdatatype.TXT, '"zxc-abc"', '"part1" "part2"'
            ),
            ("example.com", "A"): answer("example.com", dns.rdatatype.A, "203.0.113.10"),
            ("example.com", "AAAA"): error(dns.resolver.NXDOMAIN),
        },
    )

    records = await resolver.lookup(HOST)

    assert records == DnsRecords(txt=("zxc-abc", "part1part2"), a=("203.0.113.10",), aaaa=())


@pytest.mark.parametrize(
    ("failure", "reason"),
    [
        (error(dns.resolver.LifetimeTimeout, timeout=1.0, errors=[]), "timeout"),
        (error(dns.resolver.NoNameservers), "servfail"),
    ],
)
async def test_dns_failures_are_reported(
    monkeypatch: pytest.MonkeyPatch, failure: Exception, reason: str
) -> None:
    resolver = DnsPythonResolver([], 1.0)
    stub(monkeypatch, resolver, {("example.com", "A"): failure})

    assert await resolver.lookup(HOST) == DnsRecords(error=reason)


async def test_probe_fails_without_a_server() -> None:
    probe = HandshakeTlsProbe(0.5)

    assert not await probe.has_certificate(Hostname("unreachable.invalid"))
