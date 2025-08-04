import { db } from '../config/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export class User {
  static async create({ email, password, firstName, lastName }) {
    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);
    
    const result = await db.run(
      `INSERT INTO users (id, email, password_hash, first_name, last_name) 
       VALUES (?, ?, ?, ?, ?)`,
      [id, email, passwordHash, firstName, lastName]
    );

    return this.findById(id);
  }

  static async findById(id) {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (user) {
      delete user.password_hash;
    }
    return user;
  }

  static async findByEmail(email) {
    return db.get('SELECT * FROM users WHERE email = ?', [email]);
  }

  static async authenticate(email, password) {
    const user = await this.findByEmail(email);
    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return null;
    }

    delete user.password_hash;
    return user;
  }

  static async update(id, updates) {
    const allowedFields = ['first_name', 'last_name', 'onboarding_completed'];
    const filteredUpdates = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = value;
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return this.findById(id);
    }

    const setClause = Object.keys(filteredUpdates)
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = [...Object.values(filteredUpdates), id];

    await db.run(
      `UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  static generateToken(user) {
    return jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
  }

  static verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }

  static async delete(id) {
    const result = await db.run('DELETE FROM users WHERE id = ?', [id]);
    return result.changes > 0;
  }
}