module.exports = {
  apps: [{
    name: 'guru-api',
    script: 'app.js',
    cwd: '/var/www/exam-guruji/guru-api',
    env: {
      NODE_ENV: 'production',
      PORT: 4000,
      CORS_ORIGIN: '*',
      FRONTEND_URL: 'http://13.203.195.153:3000',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/guruapi_local',
      QUESTION_BANK_MODE: 'db_first',
      AI_PROVIDER: 'local',
      OPENAI_API_KEY: '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',
      OPENAI_BASE_URL: 'https://invention-detailed-polar-wars.trycloudflare.com/v1',
      GEMINI_API_KEY: 'AIzaSyAMTZtosvqjEvhbj4nCG4GPJ4WrG3E5kjc'
    }
  }]
};
