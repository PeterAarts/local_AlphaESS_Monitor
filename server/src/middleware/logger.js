// src/middleware/logger.js
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  console.log(`➡️  ${req.method} ${req.path}`);
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const emoji = status >= 500 ? '❌' : status >= 400 ? '⚠️' : '✓';
    
    console.log(`${emoji} ${req.method} ${req.path} ${status} - ${duration}ms`);
  });
  
  next();
};

export default requestLogger;