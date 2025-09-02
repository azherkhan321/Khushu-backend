const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const upload = require('../middleware/upload');
const fs = require('fs');
const path = require('path');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Convert product document images to data URLs for transport
const toDataUrlProduct = (product) => {
  const obj = product.toObject ? product.toObject() : product;
  if (Array.isArray(obj.images)) {
    obj.images = obj.images.map((img) => {
      if (!img) return '';
      if (typeof img === 'string') {
        // backward compatible: if it's a relative upload path, try converting to data URL
        if (img.startsWith('/uploads/')) {
          try {
            const filename = img.replace('/uploads/', '');
            const filePath = path.join(__dirname, '..', 'uploads', filename);
            if (fs.existsSync(filePath)) {
              const fileBuffer = fs.readFileSync(filePath);
              const contentType = 'image/' + (path.extname(filename).replace('.', '') || 'jpeg');
              const base64 = Buffer.from(fileBuffer).toString('base64');
              return `data:${contentType};base64,${base64}`;
            }
          } catch (e) {
            // ignore and fall back to string path
          }
        }
        return img;
      }
      if (img.data && img.contentType) {
        const base64 = Buffer.from(img.data).toString('base64');
        return `data:${img.contentType};base64,${base64}`;
      }
      return '';
    });
  }
  return obj;
};

// Get all products
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find({ isActive: true })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Product.countDocuments({ isActive: true })
    ]);

    const data = products.map(toDataUrlProduct);
    res.status(200).json({
      success: true,
      count: total,
      data,
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

// Search products (must come before /:id route)
router.get('/search/:query', async (req, res) => {
  try {
    const searchQuery = req.params.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const criteria = {
      $and: [
        { isActive: true },
        {
          $or: [
            { name: { $regex: searchQuery, $options: 'i' } },
            { description: { $regex: searchQuery, $options: 'i' } },
            { category: { $regex: searchQuery, $options: 'i' } }
          ]
        }
      ]
    };

    const [products, total] = await Promise.all([
      Product.find(criteria)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Product.countDocuments(criteria)
    ]);

    const data = products.map(toDataUrlProduct);
    res.status(200).json({
      success: true,
      count: total,
      data,
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

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    res.status(200).json({
      success: true,
      data: toDataUrlProduct(product)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching product',
      error: error.message
    });
  }
});

// Create new product with multiple images
router.post('/', requireAuth, requireAdmin, upload.array('images', 10), async (req, res) => {
  try {
    const { name, description, price, category, stock } = req.body;

    // Check if images were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one image is required'
      });
    }

    // Store images as binary in MongoDB
    const images = req.files.map(file => ({ data: file.buffer, contentType: file.mimetype }));

    const product = await Product.create({
      name,
      description,
      images,
      price: parseFloat(price),
      category,
      stock: parseInt(stock)
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: toDataUrlProduct(product)
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating product',
      error: error.message
    });
  }
});

// Update product
router.put('/:id', requireAuth, requireAdmin, upload.array('images', 10), async (req, res) => {
  try {
    const { name, description, price, category, stock } = req.body;
    
    let updateData = {
      name,
      description,
      price: parseFloat(price),
      category,
      stock: parseInt(stock)
    };

    // If new images are uploaded, add them to existing images (binary)
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => ({ data: file.buffer, contentType: file.mimetype }));
      const existingProduct = await Product.findById(req.params.id);
      if (existingProduct && Array.isArray(existingProduct.images)) {
        updateData.images = [...existingProduct.images, ...newImages];
      } else {
        updateData.images = newImages;
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
      data: toDataUrlProduct(product)
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating product',
      error: error.message
    });
  }
});

// Delete product (soft delete)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
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

module.exports = router; 