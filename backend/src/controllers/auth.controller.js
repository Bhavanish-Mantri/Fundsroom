const authService = require('../services/auth.service');

class AuthController {
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }

  async me(req, res) {
    return res.status(200).json({ user: req.user });
  }
}

module.exports = new AuthController();
