// src/middleware/errorHandler.js
export const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err.stack);

  // Default error
  let status = 500;
  let message = 'Internal server error';

  // Modbus errors
  if (err.message.includes('Not connected')) {
    status = 503;
    message = 'Alpha ESS system not connected';
  }

  // Database errors
  if (err.code === 'ER_DUP_ENTRY') {
    status = 409;
    message = 'Duplicate entry';
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    status = 400;
    message = err.message;
  }

  res.status(status).json({
    error: message,
    details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    timestamp: new Date().toISOString()
  });
};

export default errorHandler;