const questionBankService = require('../services/questionBankService');
const { validatePullSimilarQuestions } = require('../validators/questionBankValidator');

const pullSimilarQuestions = async (req, res) => {
  const filters = validatePullSimilarQuestions(req.body || {});
  const result = await questionBankService.pullSimilarQuestions({
    ownerId: req.user.id,
    filters,
  });

  res.json({
    data: result,
  });
};

module.exports = {
  pullSimilarQuestions,
};
