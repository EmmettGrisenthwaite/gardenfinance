import { User } from '../models/User.js';

export const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        error: 'User with this email already exists'
      });
    }

    // Create new user
    const user = await User.create({
      email,
      password,
      firstName,
      lastName
    });

    // Generate token
    const token = User.generateToken(user);

    res.status(201).json({
      message: 'User created successfully',
      user,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Authenticate user
    const user = await User.authenticate(email, password);
    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Generate token
    const token = User.generateToken(user);

    res.json({
      message: 'Login successful',
      user,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const me = async (req, res) => {
  try {
    // User is already attached by auth middleware
    res.json({
      user: req.user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const updates = req.body;
    const user = await User.update(req.user.id, updates);
    
    res.json({
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};