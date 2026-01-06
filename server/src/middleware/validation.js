// src/middleware/validation.js
export const validateCharge = (req, res, next) => {
  const { watts, targetSOC, durationHours } = req.body;

  if (!watts || !targetSOC || !durationHours) {
    return res.status(400).json({ 
      error: 'Missing required fields: watts, targetSOC, durationHours' 
    });
  }

  if (watts < 0 || watts > 5000) {
    return res.status(400).json({ 
      error: 'Watts must be between 0 and 5000' 
    });
  }

  if (targetSOC < 0 || targetSOC > 100) {
    return res.status(400).json({ 
      error: 'Target SOC must be between 0 and 100' 
    });
  }

  if (durationHours <= 0 || durationHours > 24) {
    return res.status(400).json({ 
      error: 'Duration must be between 0 and 24 hours' 
    });
  }

  next();
};

export const validateDischarge = (req, res, next) => {
  const { watts, minimumSOC, durationHours } = req.body;

  if (!watts || minimumSOC === undefined || !durationHours) {
    return res.status(400).json({ 
      error: 'Missing required fields: watts, minimumSOC, durationHours' 
    });
  }

  if (watts < 0 || watts > 5000) {
    return res.status(400).json({ 
      error: 'Watts must be between 0 and 5000' 
    });
  }

  if (minimumSOC < 0 || minimumSOC > 100) {
    return res.status(400).json({ 
      error: 'Minimum SOC must be between 0 and 100' 
    });
  }

  if (durationHours <= 0 || durationHours > 24) {
    return res.status(400).json({ 
      error: 'Duration must be between 0 and 24 hours' 
    });
  }

  next();
};

export default {
  validateCharge,
  validateDischarge
};