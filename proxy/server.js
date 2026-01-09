const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Test endpoint for Replicate
app.get('/api/replicate/test', (req, res) => {
  const apiTokenFromHeader = req.headers['x-api-token'];
  res.json({
    status: 'ok',
    message: 'Replicate proxy is running',
    apiTokenConfigured: !!apiTokenFromHeader,
    apiTokenSource: apiTokenFromHeader ? 'header' : 'none',
    timestamp: new Date().toISOString()
  });
});

// Test endpoint for fal.ai
app.get('/api/fal/test', (req, res) => {
  const apiTokenFromHeader = req.headers['x-api-token'];
  res.json({
    status: 'ok',
    message: 'fal.ai proxy is running',
    apiTokenConfigured: !!apiTokenFromHeader,
    apiTokenSource: apiTokenFromHeader ? 'header' : 'none',
    timestamp: new Date().toISOString()
  });
});

// Proxy fal.ai models discovery API
app.get('/api/fal-models', async (req, res) => {
  try {
    const apiToken = req.headers['x-api-token'];

    if (!apiToken) {
      console.error('No API token provided for fal.ai models in X-API-Token header');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API token is required. Please provide it in X-API-Token header'
      });
    }

    // Build query string from request query params
    const queryParams = new URLSearchParams(req.query).toString();
    // Use the official Platform API endpoint which properly supports category filtering
    const url = `https://api.fal.ai/v1/models${queryParams ? '?' + queryParams : ''}`;

    console.log(`Fetching fal.ai models: ${url}`);

    const config = {
      method: 'GET',
      url,
      headers: {
        'Authorization': `Key ${apiToken}`,
        'Content-Type': 'application/json',
      },
    };

    const response = await axios(config);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('fal.ai models API error:', error.message);
    if (error.response) {
      console.error('fal.ai models API error response:', JSON.stringify(error.response.data, null, 2));
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: 'Proxy error', message: error.message });
    }
  }
});

// Proxy all requests to fal.ai
app.all('/api/fal/*', async (req, res) => {
  try {
    const path = req.params[0];
    const url = `https://fal.run/${path}`;

    // Get API token from header
    const apiToken = req.headers['x-api-token'];

    if (!apiToken) {
      console.error('No API token provided for fal.ai in X-API-Token header');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API token is required. Please provide it in X-API-Token header'
      });
    }

    console.log(`Proxying ${req.method} request to fal.ai: ${url}`);

    const config = {
      method: req.method,
      url,
      headers: {
        'Authorization': `Key ${apiToken}`,
        'Content-Type': 'application/json',
      },
      data: req.body,
    };

    const response = await axios(config);

    // Forward response
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('fal.ai proxy error:', error.message);
    if (error.response) {
      console.error('fal.ai API error response:', JSON.stringify(error.response.data, null, 2));
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: 'Proxy error', message: error.message });
    }
  }
});

// Proxy all requests to Replicate
app.all('/api/replicate/*', async (req, res) => {
  try {
    const path = req.params[0];
    const url = `https://api.replicate.com/v1/${path}`;
    
    // Get API token from header only
    const apiToken = req.headers['x-api-token'];
    
    if (!apiToken) {
      console.error('No API token provided in X-API-Token header');
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'API token is required. Please provide it in X-API-Token header' 
      });
    }
    
    console.log(`Proxying ${req.method} request to: ${url}`);
    console.log(`API Token source: header`);
    
    const config = {
      method: req.method,
      url,
      headers: {
        'Authorization': `Token ${apiToken}`,
        'Content-Type': 'application/json',
        // Only add Accept header if present, avoid spreading all headers for security
        ...(req.headers.accept && { 'Accept': req.headers.accept }),
      },
      data: req.body,
    };
    
    const response = await axios(config);
    
    // Forward response
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    if (error.response) {
      console.error('Replicate API error response:', JSON.stringify(error.response.data, null, 2));
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: 'Proxy error', message: error.message });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Replicate proxy server running on port ${PORT}`);
});