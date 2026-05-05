export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500
  
  // Log 500 errors to the terminal so developers can see the stack trace
  if (statusCode === 500) {
    console.error('❌ Internal Server Error:', err)
  }

  res.status(statusCode).json({
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
}
