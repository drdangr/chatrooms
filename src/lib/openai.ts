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

interface ListModelsResponse {
  data: Array<{
    id: string
    object: string
  }>
}

/**
 * Проверяет, является ли модель моделью o1/o3 (reasoning model)
 * Модели o1/o3 не поддерживают системные промпты и требуют особого форматирования
 * 
 * ВАЖНО: Если модель недоступна, проверьте актуальные имена моделей в документации OpenAI:
 * - Модель может называться просто 'o1' вместо 'o1-preview'
 * - Требуется специальный доступ через API ключ
 * - Проверьте список доступных моделей: https://platform.openai.com/docs/models
 */
function isO1Model(model: string): boolean {
  // Проверяем модели o1/o3 (o1, o1-preview, o1-mini, o3 и т.д.)
  return model.startsWith('o1') || model.startsWith('o3') || model.includes('o1-') || model.includes('o3-')
}

/**
 * Новые модели (например, GPT-5) требуют параметра max_completion_tokens вместо max_tokens
 */
function usesMaxCompletionTokens(model: string): boolean {
  return model.startsWith('gpt-5') || model.startsWith('gpt-4.1')
}

/**
 * Некоторые модели (например, GPT-5) не поддерживают настройку temperature
 */
function supportsCustomTemperature(model: string, isO1: boolean): boolean {
  if (isO1) return false
  return !model.startsWith('gpt-5')
}

function sanitizeTemperature(temp?: number): number {
  if (typeof temp !== 'number' || Number.isNaN(temp)) {
    return 0.7
  }

  return Math.min(2, Math.max(0, temp))
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
  model: string = 'gpt-4o-mini',
  temperature?: number
): Promise<string> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OpenAI API key is not configured')
  }

  const isO1 = isO1Model(model)
  const supportsTemperature = supportsCustomTemperature(model, isO1)
  const sanitizedTemperature = sanitizeTemperature(temperature)
  
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
    temperature: supportsTemperature ? sanitizedTemperature : 'default',
  })

  // Параметры запроса - модели o1 не поддерживают temperature
  const requestBody: any = {
    model: model,
    messages: formattedMessages,
  }

  // Для моделей o1 не добавляем temperature (они не поддерживают этот параметр)
  if (!isO1) {
    if (supportsTemperature) {
      requestBody.temperature = sanitizedTemperature
    }
    if (usesMaxCompletionTokens(model)) {
      requestBody.max_completion_tokens = 1000
    } else {
      requestBody.max_tokens = 1000
    }
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
      const errorMessage = errorData.error?.message || `OpenAI API error: ${response.status} ${response.statusText}`
      
      // Более понятные сообщения об ошибках для недоступных моделей
      if (errorMessage.includes('does not exist') || errorMessage.includes('not found')) {
        throw new Error(
          `Модель "${model}" недоступна. Возможные причины:\n` +
          `1. Модель требует специального доступа через API ключ\n` +
          `2. Неправильное имя модели (проверьте документацию OpenAI)\n` +
          `3. Модель еще не опубликована для API\n\n` +
          `Оригинальная ошибка: ${errorMessage}`
        )
      }
      
      throw new Error(errorMessage)
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

/**
 * Получает список моделей, доступных для текущего API ключа
 */
export async function listOpenAIModels(): Promise<string[]> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OpenAI API key is not configured')
  }

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || `OpenAI API error: ${response.status} ${response.statusText}`
      throw new Error(errorMessage)
    }

    const data: ListModelsResponse = await response.json()
    return data.data.map((model) => model.id)
  } catch (error) {
    console.error('Failed to fetch OpenAI models:', error)
    throw error
  }
}

