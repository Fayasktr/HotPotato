const isLoggedIn = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  req.flash('error', 'You must be logged in to view that page');
  res.redirect('/login');
};

const isAdmin = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  req.flash('error', 'You do not have permission to access that page');
  res.redirect('/');
};

const isInBatch = (req, res, next) => {
  const user = req.session.user;
  const batchId = req.params.batchId || (req.body && req.body.batchId);
  
  if (!user) {
    req.flash('error', 'You must be logged in');
    return res.redirect('/login');
  }
  
  if (user.role === 'admin') return next(); // Admins can access any batch
  
  if (user.batchId && user.batchId.toString() === batchId) {
    return next();
  }
  
  req.flash('error', 'You do not belong to that batch');
  res.redirect('/');
};

module.exports = {
  isLoggedIn,
  isAdmin,
  isInBatch
};
