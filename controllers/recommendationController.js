const recommendationService = require('../services/recommendationService');
const topicAnalyzerService = require('../services/topicAnalyzerService');

const getRecommendations = async (req, res) => {
  try {
    const userId = req.user.id;
    const data = await recommendationService.getForUser(userId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAllRecommendations = async (req, res) => {
  try {
    const userId = req.user.id;
    const data = await recommendationService.getAllForUser(userId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getTopicPerformance = async (req, res) => {
  try {
    const userId = req.user.id;
    const topics = await topicAnalyzerService.analyzeUserTopics(userId);
    res.json({ success: true, data: topics });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const markCompleted = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const result = await recommendationService.markCompleted(userId, id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const dismiss = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const result = await recommendationService.dismiss(userId, id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const refresh = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await recommendationService.refresh(userId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const syncAndGenerate = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await recommendationService.syncAndGenerate(userId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const logAnswer = async (req, res) => {
  try {
    const userId = req.user.id;
    const { topic, isCorrect, confidence, questionId } = req.body;
    
    if (!topic) {
      return res.status(400).json({ error: 'topic is required' });
    }

    const result = await recommendationService.logAnswer(
      userId,
      topic,
      isCorrect,
      confidence,
      questionId
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getRecommendations,
  getAllRecommendations,
  getTopicPerformance,
  markCompleted,
  dismiss,
  refresh,
  syncAndGenerate,
  logAnswer
};
