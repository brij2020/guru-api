const StudyPlan = require('../models/studyPlan');
const mongoose = require('mongoose');

exports.create = async (req, res) => {
  try {
    const { subject, subjectId, examSlug, stageSlug, topic, date, startHour, endHour, icon, color, isBreak } = req.body;
    const userId = req.user.id;

    const studyPlan = new StudyPlan({
      userId,
      subject,
      subjectId,
      examSlug,
      stageSlug,
      topic,
      date: new Date(date),
      startHour,
      endHour,
      icon,
      color,
      isBreak,
    });

    await studyPlan.save();
    res.status(201).json({ success: true, data: studyPlan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getByDate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { date } = req.query;

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const plans = await StudyPlan.find({
      userId,
      date: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ startHour: 1 });

    res.status(200).json({ success: true, data: plans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    const query = { userId };

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const plans = await StudyPlan.find(query).sort({ date: 1, startHour: 1 });
    res.status(200).json({ success: true, data: plans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { isCompleted, progress } = req.body;

    const studyPlan = await StudyPlan.findOneAndUpdate(
      { _id: id, userId },
      { isCompleted, progress },
      { new: true }
    );

    if (!studyPlan) {
      return res.status(404).json({ success: false, message: 'Study plan not found' });
    }

    res.status(200).json({ success: true, data: studyPlan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const studyPlan = await StudyPlan.findOneAndDelete({ _id: id, userId });

    if (!studyPlan) {
      return res.status(404).json({ success: false, message: 'Study plan not found' });
    }

    res.status(200).json({ success: true, message: 'Study plan deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
