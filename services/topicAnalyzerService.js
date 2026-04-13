const TestAttempt = require('../models/testAttempt');
const UserTopicPerformance = require('../models/userTopicPerformance');
const sm2Service = require('./sm2Service');

class TopicAnalyzerService {
  async analyzeUserTopics(userId) {
    const attempts = await TestAttempt.find({
      owner: userId,
      status: 'completed'
    }).sort({ completedAt: -1 }).limit(50);

    const topicStats = {};

    for (const attempt of attempts) {
      if (!attempt.topics || attempt.topics.length === 0) continue;

      const topics = Array.isArray(attempt.topics) ? attempt.topics : [attempt.topics];

      for (const topic of topics) {
        if (!topicStats[topic]) {
          topicStats[topic] = {
            topic,
            attempts: 0,
            correct: 0,
            totalTime: 0,
            attemptDates: []
          };
        }

        topicStats[topic].attempts += 1;
        topicStats[topic].totalTime += (attempt.completion?.timeSpent || 0) / (topics.length || 1);
        topicStats[topic].attemptDates.push(attempt.completedAt);

        if (attempt.completion?.sectionScores) {
          for (const section of attempt.completion.sectionScores) {
            if (this.normalizeTopic(section.section || '') === this.normalizeTopic(topic)) {
              topicStats[topic].correct += section.correct || 0;
            }
          }
        }
      }
    }

    const results = [];
    for (const [topic, stats] of Object.entries(topicStats)) {
      const accuracy = stats.attempts > 0 
        ? Math.round((stats.correct / (stats.attempts * 10)) * 100) 
        : 0;
      
      const avgTimeSeconds = stats.attempts > 0 
        ? Math.round(stats.totalTime / stats.attempts / 1000) 
        : 0;

      const existingPerf = await UserTopicPerformance.findOne({ userId, topic });
      
      results.push({
        topic,
        totalAttempts: stats.attempts,
        correctAnswers: stats.correct,
        accuracy,
        avgTimeSeconds,
        lastAttemptedAt: stats.attemptDates[0] || null,
        easeFactor: existingPerf?.easeFactor || 2.5,
        interval: existingPerf?.interval || 1,
        nextReviewAt: existingPerf?.nextReviewAt || null,
        wrongQuestionIds: existingPerf?.wrongQuestionIds || [],
        trend: existingPerf?.trend || 'stable',
        trendDelta: existingPerf?.trendDelta || 0
      });
    }

    return results.sort((a, b) => a.accuracy - b.accuracy);
  }

  normalizeTopic(topic) {
    return topic.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  async syncTopicPerformance(userId) {
    const analysis = await this.analyzeUserTopics(userId);
    
    for (const data of analysis) {
      const weekKey = sm2Service.getWeekKey();
      
      let performance = await UserTopicPerformance.findOne({ 
        userId, 
        topic: data.topic 
      });

      if (!performance) {
        performance = new UserTopicPerformance({
          userId,
          topic: data.topic
        });
      }

      performance.totalAttempts = data.totalAttempts;
      performance.correctAnswers = data.correctAnswers;
      performance.accuracy = data.accuracy;
      performance.avgTimeSeconds = data.avgTimeSeconds;
      performance.lastAttemptedAt = data.lastAttemptedAt;

      let weekData = performance.weeklyAccuracy.find(w => w.week === weekKey);
      if (!weekData) {
        performance.weeklyAccuracy.push({ week: weekKey, accuracy: data.accuracy, attempts: data.totalAttempts });
      } else {
        weekData.accuracy = data.accuracy;
        weekData.attempts = data.totalAttempts;
      }

      if (performance.weeklyAccuracy.length > 8) {
        performance.weeklyAccuracy = performance.weeklyAccuracy.slice(-8);
      }

      const trendResult = performance.calculateTrend();
      performance.trend = trendResult.trend;
      performance.trendDelta = trendResult.trendDelta;

      await performance.save();
    }

    return analysis;
  }

  getWeakAreas(topics, threshold = 60) {
    return topics.filter(t => t.accuracy < threshold && t.totalAttempts >= 3);
  }

  getDecliningTopics(topics, threshold = -10) {
    return topics.filter(t => t.trend === 'declining' && t.trendDelta < threshold);
  }

  getImprovingTopics(topics, threshold = 10) {
    return topics.filter(t => t.trend === 'improving' && t.trendDelta > threshold);
  }

  getStrongTopics(topics, threshold = 80) {
    return topics.filter(t => t.accuracy >= threshold);
  }
}

module.exports = new TopicAnalyzerService();
