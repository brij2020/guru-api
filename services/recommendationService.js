const mongoose = require('mongoose');
const UserRecommendation = require('../models/userRecommendation');
const UserTopicPerformance = require('../models/userTopicPerformance');
const topicAnalyzerService = require('./topicAnalyzerService');
const sm2Service = require('./sm2Service');

const MAX_RECOMMENDATIONS = 10;

class RecommendationService {
  generateId() {
    return new mongoose.Types.ObjectId().toString();
  }

  async generateForUser(userId) {
    const topics = await topicAnalyzerService.analyzeUserTopics(userId);
    const recommendations = [];

    const declining = topics.filter(t => t.trend === 'declining' && t.trendDelta < -10);
    const weak = topics.filter(t => t.accuracy < 60 && t.totalAttempts >= 3 && t.trend !== 'declining');
    const dueForRevision = topics.filter(t => t.nextReviewAt && new Date(t.nextReviewAt) <= new Date());
    const strong = topics.filter(t => t.accuracy >= 80).slice(0, 2);

    for (const topic of declining) {
      recommendations.push({
        type: 'topic',
        itemId: topic.topic,
        title: `Improve "${topic.topic}"`,
        titleHi: `"${topic.topic}" में सुधार करें`,
        reason: `Accuracy dropped ${Math.abs(topic.trendDelta)}% this week`,
        reasonHi: `इस सप्ताह सटीकता ${Math.abs(topic.trendDelta)}% गिरी`,
        priority: 10,
        topic: topic.topic,
        difficulty: 'medium',
        questionCount: 10,
        dueAt: null
      });
    }

    for (const topic of dueForRevision) {
      recommendations.push({
        type: 'revision',
        itemId: topic.topic,
        title: `Review "${topic.topic}"`,
        titleHi: `"${topic.topic}" की समीक्षा करें`,
        reason: 'Scheduled revision due',
        reasonHi: 'निर्धारित संशोधन देय',
        priority: 8,
        topic: topic.topic,
        difficulty: 'all',
        questionCount: 5,
        dueAt: topic.nextReviewAt
      });
    }

    for (const topic of weak.slice(0, 3)) {
      recommendations.push({
        type: 'practice',
        itemId: topic.topic,
        title: `Practice "${topic.topic}"`,
        titleHi: `"${topic.topic}" का अभ्यास करें`,
        reason: `Accuracy only ${topic.accuracy}% - needs improvement`,
        reasonHi: `सटीकता केवल ${topic.accuracy}% - सुधार की जरूरत`,
        priority: 6,
        topic: topic.topic,
        difficulty: 'medium',
        questionCount: 10,
        dueAt: null
      });
    }

    for (const topic of strong) {
      recommendations.push({
        type: 'improvement',
        itemId: topic.topic,
        title: `Maintain "${topic.topic}"`,
        titleHi: `"${topic.topic}" बनाए रखें`,
        reason: `Strong at ${topic.accuracy}% - keep it up!`,
        reasonHi: `${topic.accuracy}% में मजबूत - जारी रखें!`,
        priority: 3,
        topic: topic.topic,
        difficulty: 'hard',
        questionCount: 5,
        dueAt: null
      });
    }

    recommendations.sort((a, b) => b.priority - a.priority);
    const finalRecs = recommendations.slice(0, MAX_RECOMMENDATIONS);

    let userRec = await UserRecommendation.findOne({ userId });
    if (userRec) {
      userRec.recommendations = finalRecs.map(r => ({ ...r, id: this.generateId() }));
      userRec.generatedAt = new Date();
      userRec.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    } else {
      userRec = new UserRecommendation({
        userId,
        recommendations: finalRecs.map(r => ({ ...r, id: this.generateId() })),
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
    }

    await userRec.save();
    return userRec;
  }

  async getForUser(userId) {
    let userRec = await UserRecommendation.findOne({ userId });
    
    if (!userRec || new Date(userRec.expiresAt) < new Date()) {
      userRec = await this.generateForUser(userId);
    }

    return {
      recommendations: userRec.getActiveRecommendations(),
      completedCount: userRec.getCompletedCount(),
      totalCount: userRec.recommendations.length,
      generatedAt: userRec.generatedAt,
      expiresAt: userRec.expiresAt
    };
  }

  async getAllForUser(userId) {
    const userRec = await UserRecommendation.findOne({ userId });
    if (!userRec) {
      return this.getForUser(userId);
    }

    return {
      recommendations: userRec.recommendations,
      completedCount: userRec.getCompletedCount(),
      totalCount: userRec.recommendations.length,
      generatedAt: userRec.generatedAt
    };
  }

  async markCompleted(userId, recommendationId) {
    const userRec = await UserRecommendation.findOne({ userId });
    if (!userRec) return null;

    const rec = userRec.recommendations.find(r => r.id === recommendationId);
    if (rec) {
      rec.completed = true;
      rec.completedAt = new Date();
      await userRec.save();
    }

    return rec;
  }

  async dismiss(userId, recommendationId) {
    const userRec = await UserRecommendation.findOne({ userId });
    if (!userRec) return null;

    const rec = userRec.recommendations.find(r => r.id === recommendationId);
    if (rec) {
      rec.dismissed = true;
      rec.dismissedAt = new Date();
      await userRec.save();
    }

    return rec;
  }

  async refresh(userId) {
    return this.generateForUser(userId);
  }

  async logAnswer(userId, topic, isCorrect, confidence = 'medium', questionId = null) {
    const result = await sm2Service.updateTopicPerformance(userId, topic, isCorrect, confidence);
    
    if (!isCorrect && questionId) {
      await sm2Service.addWrongQuestion(userId, topic, questionId);
    } else if (isCorrect && questionId) {
      await sm2Service.removeWrongQuestion(userId, topic, questionId);
    }

    return result;
  }

  async getTopicPerformance(userId) {
    return UserTopicPerformance.find({ userId, totalAttempts: { $gt: 0 } })
      .sort({ accuracy: 1 });
  }

  async syncAndGenerate(userId) {
    await topicAnalyzerService.syncTopicPerformance(userId);
    return this.generateForUser(userId);
  }
}

module.exports = new RecommendationService();
