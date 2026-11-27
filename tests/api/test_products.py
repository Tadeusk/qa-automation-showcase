import pytest

from framework.client_api import ClientAPI
from framework.config import get_settings


@pytest.fixture
def api_client():
    settings = get_settings()
    client = ClientAPI(base_url=settings.base_url)
    try:
        login_response = client.login(
            email=settings.user_email,
            password=settings.user_password,
        )
        assert login_response.status_code == 200, (
            f"Login failed with status {login_response.status_code}: {login_response.text}"
        )
        yield client
    finally:
        client.close()


class TestProductsAPI:
    def test_get_products(self, api_client: ClientAPI):
        response = api_client.get_products()
        assert response.status_code == 200
        assert isinstance(response.body, list)
        assert len(response.body) > 0
