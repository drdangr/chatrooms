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

/**
 * Проверяет, является ли модель моделью o1 (reasoning model)
 * Модели o1 не поддерживают системные промпты и требуют особого форматирования
 */
function isO1Model(model: string): boolean {
  return model.startsWith('o1') || model.includes('o1-')
}

/**
 * Форматирует сообщения для моделей o1
 * Модели o1 не поддерживают системные сообщения - системный промпт встраивается в первое пользовательское сообщение
 */
function formatMessagesForO1(
  systemPrompt: string,
  messages: Array<{ sender_name: string; text: string }>
): Message[] {
  const formattedMessages: Message[] = []
  
  // Встраиваем системный промпт в первое сообщение
  const systemInstruction = systemPrompt?.trim() || 'Вы - полезный ассистент.'
  
  if (messages.length === 0) {
    // Если нет сообщений, создаем одно с системным промптом
    formattedMessages.push({
      role: 'user',
      content: systemInstruction,
    })
  } else {
    // Встраиваем системный промпт в первое сообщение
    const firstMessage = messages[0]
    formattedMessages.push({
      role: 'user',
      content: `${systemInstruction}\n\n${firstMessage.sender_name}: ${firstMessage.text}`,
    })
    
    // Остальные сообщения добавляем как обычно
    for (let i = 1; i < messages.length; i++) {
      formattedMessages.push({
        role: 'user',
        content: `${messages[i].sender_name}: ${messages[i].text}`,
      })
    }
  }
  
  return formattedMessages
}

/**
 * Форматирует сообщения для обычных моделей (с поддержкой системного промпта)
 */
function formatMessagesForStandard(
  systemPrompt: string,
  messages: Array<{ sender_name: string; text: string }>
): Message[] {
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

  return formattedMessages
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

  const isO1 = isO1Model(model)
  
  // Форматируем сообщения в зависимости от модели
  const formattedMessages = isO1
    ? formatMessagesForO1(systemPrompt, messages)
    : formatMessagesForStandard(systemPrompt, messages)

  // Логируем форматирование для отладки
  console.log('📤 OpenAI API request:', {
    model,
    isO1Model: isO1,
    messagesCount: formattedMessages.length,
    firstMessagePreview: formattedMessages[0]?.content?.substring(0, 100),
    hasSystemPrompt: !isO1 && formattedMessages[0]?.role === 'system',
  })

  // Параметры запроса - модели o1 не поддерживают temperature
  const requestBody: any = {
    model: model,
    messages: formattedMessages,
  }

  // Для моделей o1 не добавляем temperature (они не поддерживают этот параметр)
  if (!isO1) {
    requestBody.temperature = 0.7
    requestBody.max_tokens = 1000
  } else {
    // Для моделей o1 можно указать max_tokens, но обычно это не требуется
    // Они управляют длиной ответа автоматически
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
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

