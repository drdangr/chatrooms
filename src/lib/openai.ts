interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      role: string
      content: string
    }
  }>
}

export async function callOpenAI(
  systemPrompt: string,
  messages: Array<{ sender_name: string; text: string }>,
  model: string = 'gpt-4o-mini'
): Promise<string> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OpenAI API key is not configured')
  }

  // Format messages for OpenAI API
  const formattedMessages: Message[] = [
    {
      role: 'system',
      content: systemPrompt || 'Вы - полезный ассистент.',
    },
  ]

  // Convert chat messages to OpenAI format
  messages.forEach((msg) => {
    formattedMessages.push({
      role: 'user',
      content: `${msg.sender_name}: ${msg.text}`,
    })
  })

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.error?.message ||
          `OpenAI API error: ${response.status} ${response.statusText}`
      )
    }

    const data: ChatCompletionResponse = await response.json()

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from OpenAI')
    }

    return data.choices[0].message.content.trim()
  } catch (error) {
    console.error('OpenAI API error:', error)
    throw error
  }
}

