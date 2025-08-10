# Khushu Admin Backend

A Node.js backend API for the Khushu Admin Dashboard with MongoDB integration.

## Features

- Express.js server with CORS support
- MongoDB database with Mongoose ODM
- Product management with CRUD operations
- Multiple image upload support using Multer
- RESTful API endpoints
- Error handling and validation

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local installation or MongoDB Atlas)
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `config.env` file in the root directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/khushu_admin
NODE_ENV=development
```

3. Start MongoDB service (if using local MongoDB)

4. Run the development server:
```bash
npm run dev
```

## API Endpoints

### Products

- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create new product (with images)
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product (soft delete)
- `GET /api/products/search/:query` - Search products

### Product Schema

```javascript
{
  name: String (required, max 100 chars),
  description: String (required, max 1000 chars),
  images: [String] (required, array of image URLs),
  price: Number (required, min 0),
  category: String (required, enum),
  stock: Number (required, min 0),
  isActive: Boolean (default: true),
  createdAt: Date,
  updatedAt: Date
}
```

### Image Upload

- Supports multiple image uploads (max 10 files)
- File size limit: 5MB per image
- Accepted formats: JPG, PNG, GIF, WebP
- Images are stored in `/uploads` directory

## File Structure

```
backend/
├── models/
│   └── Product.js
├── routes/
│   └── productRoutes.js
├── middleware/
│   └── upload.js
├── uploads/
├── server.js
├── config.env
├── package.json
└── README.md
```

## Usage Examples

### Create Product
```bash
curl -X POST http://localhost:5000/api/products \
  -F "name=Wireless Headphones" \
  -F "description=High-quality wireless headphones" \
  -F "price=99.99" \
  -F "category=Electronics" \
  -F "stock=50" \
  -F "images=@image1.jpg" \
  -F "images=@image2.jpg"
```

### Get All Products
```bash
curl http://localhost:5000/api/products
```

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

## Development

- Server runs on `http://localhost:5000`
- MongoDB connection: `mongodb://localhost:27017/khushu_admin`
- Hot reload with nodemon
- CORS enabled for frontend integration 