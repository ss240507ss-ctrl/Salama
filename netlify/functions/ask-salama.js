const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { question, conversationHistory, userName, userRole } = JSON.parse(event.body);

    // Build conversation context
    let conversationContext = '';
    if (conversationHistory && conversationHistory.length > 0) {
      conversationContext = conversationHistory.slice(-6).map(msg => 
        `${msg.sender === 'me' ? 'User' : 'Salama'}: ${msg.text}`
      ).join('\n') + '\n';
    }

    const systemPrompt = `You are Salama, a warm, caring AI companion for ${userName}, who is a ${userRole === 'care_recipient' ? 'care recipient who may need extra support and kindness' : 'caregiver supporting someone in need'}. 

Your role is to:
- Provide emotional support and companionship
- Answer questions clearly and patiently
- Help with safety concerns (scams, suspicious calls, unexpected visitors)
- Be encouraging and kind
- Alert caregivers when there are safety or health concerns
- Remember you're talking to someone who may be elderly, disabled, or vulnerable
- Keep responses concise but warm (2-4 sentences usually)

Always be patient, kind, and supportive. If the person seems distressed, in pain, or in danger, acknowledge their concern seriously and mention that their caregivers will be notified.

Previous conversation:
${conversationContext}

User's current message: ${question}

Respond as Salama:`;

    // Call Gemini API (API key is safe on the server!)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: systemPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          }
        })
      }
    );

    const data = await response.json();

    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const aiResponse = data.candidates[0].content.parts[0].text;
      
      // Check if we should alert caregivers
      const shouldAlert = question.toLowerCase().includes('pain') || 
                         question.toLowerCase().includes('hurt') ||
                         question.toLowerCase().includes('scam') ||
                         question.toLowerCase().includes('suspicious') ||
                         question.toLowerCase().includes('help') ||
                         question.toLowerCase().includes('emergency') ||
                         question.toLowerCase().includes('fell') ||
                         question.toLowerCase().includes('sick');
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          response: aiResponse,
          shouldAlert: shouldAlert
        })
      };
    } else {
      throw new Error('Invalid response from AI');
    }

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to get AI response',
        fallback: true 
      })
    };
  }
};
