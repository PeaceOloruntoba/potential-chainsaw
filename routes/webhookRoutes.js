const express = require("express");
const router = express.Router();
const webhookController = require("../controllers/webhookController");

router.post("/stripe", webhookController.handleStripeWebhook);

module.exports = router;
