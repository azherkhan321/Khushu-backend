const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: './config.env' });

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Auth routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB Atlas successfully');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

// Basic route for testing
app.get('/', (req, res) => {
  res.json({ message: 'Khushu Admin Backend API is running!' });
});

// Get all products with pagination
app.get('/api/products', async (req, res) => {
  try {
    const Product = require('./models/Product');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const products = await Product.find({ isActive: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments({ isActive: true });

    res.status(200).json({
      success: true,
      count: total,
      data: products,
      page,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message
    });
  }
});

// Search products with pagination
app.get('/api/products/search/:query', async (req, res) => {
  try {
    const Product = require('./models/Product');
    const searchQuery = req.params.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const products = await Product.find({
      $and: [
        { isActive: true },
        {
          $or: [
            { name: { $regex: searchQuery, $options: 'i' } },
            { description: { $regex: searchQuery, $options: 'i' } }
          ]
        }
      ]
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    const total = await Product.countDocuments({
      $and: [
        { isActive: true },
        {
          $or: [
            { name: { $regex: searchQuery, $options: 'i' } },
            { description: { $regex: searchQuery, $options: 'i' } }
          ]
        }
      ]
    });

    res.status(200).json({
      success: true,
      count: total,
      data: products,
      page,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
      searchQuery
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error searching products',
      error: error.message
    });
  }
});

const { requireAuth, requireAdmin } = require('./middleware/auth');

const upload = require('./middleware/upload'); // adjust path as needed

app.post('/api/products', requireAuth, requireAdmin, (req, res) => {
  const Product = require('./models/Product');

  upload.array('images', 10)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: 'File upload error',
        error: err.message
      });
    }

    try {
      const { name, description, price, stock } = req.body;

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one image is required'
        });
      }

      // Convert uploaded files to Buffers
      const images = req.files.map(file => ({
        data: file.buffer,
        contentType: file.mimetype
      }));

      const product = await Product.create({
        name,
        description,
        price: parseFloat(price),
        stock: parseInt(stock),
        images
      });

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: product
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Error creating product',
        error: error.message
      });
    }
  });
});



app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean(); // lean() returns plain JS object

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Ensure images array exists
    const images = (product.images || []).map(img => {
      if (img?.data) {
        // ensure Buffer
        const bufferData = Buffer.isBuffer(img.data) ? img.data : Buffer.from(img.data.data);
        return `data:${img.contentType};base64,${bufferData.toString('base64')}`;
      }
      return null;
    }).filter(Boolean);
    
    product.images = images;

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});




// Update product
app.put('/api/products/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const Product = require('./models/Product');
    const upload = require('./middleware/upload');
    
    upload.array('images', 10)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: 'File upload error',
          error: err.message
        });
      }

      try {
        const { name, description, price, stock } = req.body;
        
        let updateData = {
          name,
          description,
          price: parseFloat(price),
          stock: parseInt(stock)
        };

        // If new images are uploaded, add them to existing images
        if (req.files && req.files.length > 0) {
          const newImages = req.files.map(file => `/uploads/${file.filename}`);
          
          // Get existing product to merge images
          const existingProduct = await Product.findById(req.params.id);
          if (existingProduct) {
            updateData.images = [...existingProduct.images, ...newImages];
          }
        }

        const product = await Product.findByIdAndUpdate(
          req.params.id,
          updateData,
          { new: true, runValidators: true }
        );

        if (!product) {
          return res.status(404).json({
            success: false,
            message: 'Product not found'
          });
        }

        res.status(200).json({
          success: true,
          message: 'Product updated successfully',
          data: product
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          message: 'Error updating product',
          error: error.message
        });
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Delete product
app.delete('/api/products/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const Product = require('./models/Product');
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting product',
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 