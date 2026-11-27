from pydantic import BaseModel
from typing import Any
from framework.config import get_settings
import httpx


class ResponseAPI(BaseModel):
    status_code: int
    body: Any
    text: str = ""

class ClientAPI:
    base_url: str
    _token: str | None

    def __init__(self, base_url: str | None = None, timeout_ms: int | None = None):
        settings = get_settings()
        self.base_url = base_url or settings.base_url
        timeout = (timeout_ms or settings.default_timeout_ms) / 1000
        self._token = None
        self._client = httpx.Client(base_url=self.base_url, timeout=timeout)

    def close(self) -> None:
        self._client.close()

    def _request(self, method: str, path: str, *, json: Any = None, 
                 headers: dict[str, str] | None = None,
                 authenticated: bool = False) -> ResponseAPI:
        if authenticated and not self._token:
            raise ValueError("Authentication required")

        if authenticated:
            request_headers = {**(headers or {}), "Authorization": f"Bearer {self._token}"}

        response = self._client.request(method, path, json=json, headers=request_headers if authenticated else headers)
        try:
            json_body = response.json()
        except (ValueError, httpx.DecodingError):
            json_body = None
        return ResponseAPI(
            status_code=response.status_code,
            body=json_body,
            text=response.text,
        )

    def login(self, email: str, password: str) -> ResponseAPI:
        response = self._request(method="POST", path="/api/auth/login", json={"email": email, "password": password})
        try:
            token = response.body.get("access_token") if isinstance(response.body, dict) else None
            self._token = token if response.status_code == 200 else None
        except Exception as e:
            self._token = None
        return response

    def get_products(self) -> ResponseAPI:
        response = self._request(method="GET", path="/api/products", authenticated=True)
        return response