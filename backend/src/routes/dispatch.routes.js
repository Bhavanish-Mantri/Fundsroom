const express = require('express');
const dispatchService = require('../services/dispatch.service');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const list = await dispatchService.getAllDispatches();
    return res.status(200).json(list);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await dispatchService.getDispatchById(req.params.id);
    return res.status(200).json(item);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
