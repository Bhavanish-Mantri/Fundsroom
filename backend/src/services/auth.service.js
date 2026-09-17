const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../db/prisma');
const { JWT_SECRET } = require('../middleware/auth.middleware');

class AuthService {
  async login(email, password) {
    if (!email || !password) {
      const err = new Error('Email and password are required.');
      err.status = 400;
      throw err;
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      const err = new Error('Invalid email or password.');
      err.status = 401;
      throw err;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      const err = new Error('Invalid email or password.');
      err.status = 401;
      throw err;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}

module.exports = new AuthService();
