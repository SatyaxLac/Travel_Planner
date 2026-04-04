import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from travel_agent.tools.payment import _process_razorpay_payment, process_payment


class TestPaymentFallback(unittest.TestCase):
    def test_invalid_razorpay_key_id_uses_mock_payment(self):
        with patch("travel_agent.tools.payment.Config.refresh"), patch(
            "travel_agent.tools.payment.Config.RAZORPAY_KEY_ID", "not-a-razorpay-key"
        ), patch(
            "travel_agent.tools.payment.Config.RAZORPAY_KEY_SECRET", "validsecret123"
        ), patch(
            "travel_agent.tools.payment._process_razorpay_payment"
        ) as mock_razorpay:
            result = process_payment(1500, "inr", customer_email="demo@example.com")

        mock_razorpay.assert_not_called()
        self.assertEqual(result["status"], "success")
        self.assertTrue(result["mock"])
        self.assertIn("valid Razorpay key ID", result["message"])

    def test_razorpay_auth_failure_falls_back_to_mock_payment(self):
        failed_result = {
            "status": "failed",
            "error": "authentication_error",
            "message": "Payment service configuration error. Please contact support.",
            "amount": 1500,
            "currency": "INR",
        }

        with patch("travel_agent.tools.payment.Config.refresh"), patch(
            "travel_agent.tools.payment.Config.RAZORPAY_KEY_ID", "rzp_test_validshape"
        ), patch(
            "travel_agent.tools.payment.Config.RAZORPAY_KEY_SECRET", "validsecret123"
        ), patch(
            "travel_agent.tools.payment._process_razorpay_payment",
            return_value=failed_result,
        ):
            result = process_payment(1500, "inr", customer_email="demo@example.com")

        self.assertEqual(result["status"], "success")
        self.assertTrue(result["mock"])
        self.assertIn("demo payment mode", result["message"])

    @patch("travel_agent.tools.payment.Config.RAZORPAY_KEY_ID", "rzp_test_example")
    @patch("travel_agent.tools.payment.Config.RAZORPAY_KEY_SECRET", "validsecret123")
    @patch("travel_agent.tools.payment.httpx.post")
    def test_razorpay_payment_link_returns_pending_result(self, mock_post):
        response = Mock()
        response.status_code = 200
        response.json.return_value = {
            "id": "plink_test_123",
            "status": "created",
            "short_url": "https://rzp.io/i/demo123",
        }
        response.raise_for_status.return_value = None
        mock_post.return_value = response

        result = _process_razorpay_payment(
            amount=210654,
            currency="inr",
            description="Flight booking payment",
            customer_email="demo@example.com",
            metadata={"booking_id": "BK123"},
            idempotency_key="payment_demo_123",
        )

        self.assertEqual(result["status"], "pending")
        self.assertEqual(result["provider"], "razorpay")
        self.assertEqual(result["payment_status"], "created")
        self.assertEqual(result["payment_url"], "https://rzp.io/i/demo123")
        self.assertIn("payment link created", result["message"].lower())


if __name__ == "__main__":
    unittest.main()
