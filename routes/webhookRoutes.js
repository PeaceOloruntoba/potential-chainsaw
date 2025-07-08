const express = require("express");
const router = express.Router();
const webhookController = require("../controllers/webhookController");

router.post("/stripe", webhookController.handleStripeWebhook);
router.post("/paypal", webhookController.handlePaypalWebhook);

module.exports = router;
