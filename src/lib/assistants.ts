import { supabase } from './supabase'

const ASSISTANTS_API_VERSION = 'assistants=v2'

interface AssistantConfig {
  assistantId: string
  threadId: string
  roomId: string
  lastUpdated: string
}

interface RunStatus {
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'expired' | 'requires_action'
  error?: any
}

/**
 * Получает API ключ OpenAI из переменных окружения
 */
function getApiKey(): string {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured')
  }
  return apiKey
}

/**
 * Создает заголовки для запросов к Assistants API
 */
function getAssistantsHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getApiKey()}`,
    'OpenAI-Beta': ASSISTANTS_API_VERSION,
  }
}

/**
 * Загружает файл в OpenAI для использования в Assistant
 * @param fileBuffer - содержимое файла
 * @param fileName - имя файла
 * @returns OpenAI file ID
 */
export async function uploadFileToOpenAI(
  fileBuffer: ArrayBuffer,
  fileName: string
): Promise<string> {
  try {
    const apiKey = getApiKey()
    
    // Создаем FormData для загрузки файла
    const formData = new FormData()
    const blob = new Blob([fileBuffer])
    formData.append('file', blob, fileName)
    formData.append('purpose', 'assistants')  // Важно для Assistants API
    
    const response = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || `OpenAI API error: ${response.status} ${response.statusText}`
      throw new Error(`Ошибка загрузки файла в OpenAI: ${errorMessage}`)
    }
    
    const fileData = await response.json()
    return fileData.id
  } catch (error) {
    console.error('Error uploading file to OpenAI:', error)
    throw error
  }
}

/**
 * Создает Assistant с указанными параметрами и инструментами
 * @param systemPrompt - системный промпт
 * @param model - модель для использования
 * @param fileIds - массив OpenAI file IDs для прикрепления
 * @param tools - массив инструментов (file_search, code_interpreter, function)
 * @returns OpenAI Assistant ID
 */
export async function createAssistant(
  systemPrompt: string,
  model: string = 'gpt-4o',
  fileIds: string[] = [],
  tools: Array<{ type: 'file_search' | 'code_interpreter' | 'function' }> = [
    { type: 'file_search' },
    { type: 'code_interpreter' },
  ]
): Promise<string> {
  try {
    // В Assistants API v2 файлы прикрепляются через vector stores
    // Для начала создаем Assistant без файлов
    const requestBody: any = {
      model,
      name: `Assistant for room`,
      instructions: systemPrompt || 'Вы - полезный ассистент.',
      tools,
    }
    
    // Если есть файлы и есть инструмент file_search, создаем vector store
    let vectorStoreId: string | null = null
    if (fileIds.length > 0 && tools.some(t => t.type === 'file_search')) {
      try {
        console.log(`📦 Creating vector store with ${fileIds.length} files:`, fileIds)
        
        // Создаем vector store с файлами
        const vectorStoreResponse = await fetch('https://api.openai.com/v1/vector_stores', {
          method: 'POST',
          headers: getAssistantsHeaders(),
          body: JSON.stringify({
            name: `Vector store for room`,
            file_ids: fileIds,
          }),
        })
        
        if (vectorStoreResponse.ok) {
          const vectorStore = await vectorStoreResponse.json()
          vectorStoreId = vectorStore.id
          console.log('✅ Vector store created:', vectorStoreId)
          console.log('📋 Vector store details:', {
            id: vectorStoreId,
            file_count: vectorStore.file_counts,
            status: vectorStore.status,
          })
          
          // Добавляем vector store в tool_resources
          requestBody.tool_resources = {
            file_search: {
              vector_store_ids: [vectorStoreId],
            },
          }
        } else {
          const errorData = await vectorStoreResponse.json().catch(() => ({}))
          console.warn('❌ Could not create vector store:', errorData.error?.message)
          console.warn('Error details:', errorData)
          // Продолжаем создание Assistant без vector store
        }
      } catch (vsError) {
        console.warn('❌ Error creating vector store:', vsError)
        // Продолжаем создание Assistant без файлов
      }
    }
    
    const response = await fetch('https://api.openai.com/v1/assistants', {
      method: 'POST',
      headers: getAssistantsHeaders(),
      body: JSON.stringify(requestBody),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || `OpenAI API error: ${response.status} ${response.statusText}`
      
      if (errorMessage.includes('does not exist') || errorMessage.includes('not found')) {
        throw new Error(
          `Модель "${model}" недоступна для Assistants API. Возможные причины:\n` +
          `1. Модель не поддерживает Assistants API\n` +
          `2. Требуется специальный доступ через API ключ\n\n` +
          `Оригинальная ошибка: ${errorMessage}`
        )
      }
      
      throw new Error(`Ошибка создания Assistant: ${errorMessage}`)
    }
    
    const assistant = await response.json()
    return assistant.id
  } catch (error) {
    console.error('Error creating assistant:', error)
    throw error
  }
}

/**
 * Создает новый Thread
 * @returns OpenAI Thread ID
 */
export async function createThread(): Promise<string> {
  try {
    const response = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: getAssistantsHeaders(),
      body: JSON.stringify({}),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || `OpenAI API error: ${response.status} ${response.statusText}`
      throw new Error(`Ошибка создания Thread: ${errorMessage}`)
    }
    
    const thread = await response.json()
    return thread.id
  } catch (error) {
    console.error('Error creating thread:', error)
    throw error
  }
}

/**
 * Проверяет статус выполнения Run
 * @param threadId - ID thread
 * @param runId - ID run
 * @returns статус выполнения
 */
export async function pollRunStatus(
  threadId: string,
  runId: string,
  maxWaitTime: number = 60000,  // 60 секунд по умолчанию
  pollInterval: number = 1000    // 1 секунда между проверками
): Promise<RunStatus> {
  const startTime = Date.now()
  
  while (true) {
    const response = await fetch(
      `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
      {
        headers: getAssistantsHeaders(),
      }
    )
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || `OpenAI API error: ${response.status} ${response.statusText}`
      throw new Error(`Ошибка проверки статуса Run: ${errorMessage}`)
    }
    
    const runData = await response.json()
    const status = runData.status
    
    if (status === 'completed') {
      return { status: 'completed' }
    }
    
    if (status === 'failed' || status === 'cancelled' || status === 'expired') {
      return {
        status,
        error: runData.last_error,
      }
    }
    
    if (status === 'requires_action') {
      return { status: 'requires_action' }
    }
    
    // Проверка таймаута
    if (Date.now() - startTime > maxWaitTime) {
      throw new Error(`Таймаут ожидания ответа от Assistant (${maxWaitTime}ms)`)
    }
    
    // Ожидание перед следующей проверкой
    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }
}

/**
 * Отправляет сообщение в Thread и запускает Assistant
 * @param threadId - ID thread
 * @param assistantId - ID assistant
 * @param message - текст сообщения
 * @param imageFileIds - массив OpenAI file IDs изображений для прикрепления
 * @returns Run ID
 */
export async function createMessageAndRun(
  threadId: string,
  assistantId: string,
  message: string,
  imageFileIds: string[] = []
): Promise<string> {
  try {
    // Формируем content для сообщения
    // Если есть изображения, используем массив content, иначе просто текст
    let content: string | Array<{ type: string; text?: string; image_file?: { file_id: string } }>
    
    if (imageFileIds.length > 0) {
      // Комбинированное сообщение: текст + изображения
      content = [
        { type: 'text', text: message },
        ...imageFileIds.map(fileId => ({
          type: 'image_file' as const,
          image_file: { file_id: fileId }
        }))
      ]
    } else {
      // Только текст
      content = message
    }
    
    // 1. Добавляем сообщение в thread
    const messageResponse = await fetch(
      `https://api.openai.com/v1/threads/${threadId}/messages`,
      {
        method: 'POST',
        headers: getAssistantsHeaders(),
        body: JSON.stringify({
          role: 'user',
          content: content,
        }),
      }
    )
    
    if (!messageResponse.ok) {
      const errorData = await messageResponse.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || `OpenAI API error: ${messageResponse.status}`
      throw new Error(`Ошибка добавления сообщения в Thread: ${errorMessage}`)
    }
    
    // 2. Запускаем assistant
    const runResponse = await fetch(
      `https://api.openai.com/v1/threads/${threadId}/runs`,
      {
        method: 'POST',
        headers: getAssistantsHeaders(),
        body: JSON.stringify({
          assistant_id: assistantId,
        }),
      }
    )
    
    if (!runResponse.ok) {
      const errorData = await runResponse.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || `OpenAI API error: ${runResponse.status}`
      throw new Error(`Ошибка запуска Assistant: ${errorMessage}`)
    }
    
    const run = await runResponse.json()
    return run.id
  } catch (error) {
    console.error('Error creating message and run:', error)
    throw error
  }
}

/**
 * Получает последнее сообщение из Thread
 * @param threadId - ID thread
 * @returns текст последнего сообщения
 */
export async function getLastMessageFromThread(threadId: string): Promise<string> {
  try {
    const response = await fetch(
      `https://api.openai.com/v1/threads/${threadId}/messages?limit=1&order=desc`,
      {
        headers: getAssistantsHeaders(),
      }
    )
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || `OpenAI API error: ${response.status}`
      throw new Error(`Ошибка получения сообщений из Thread: ${errorMessage}`)
    }
    
    const data = await response.json()
    const messages = data.data || []
    
    if (messages.length === 0) {
      throw new Error('Нет сообщений в Thread')
    }
    
    const lastMessage = messages[0]
    // Сообщение может содержать текст или массив content items
    if (lastMessage.content && lastMessage.content.length > 0) {
      const textContent = lastMessage.content.find((item: any) => item.type === 'text')
      if (textContent && textContent.text) {
        return textContent.text.value
      }
    }
    
    throw new Error('Не удалось извлечь текст из сообщения')
  } catch (error) {
    console.error('Error getting last message from thread:', error)
    throw error
  }
}

/**
 * Отправляет сообщение через Assistants API и получает ответ
 * @param assistantId - ID assistant
 * @param threadId - ID thread
 * @param message - текст сообщения
 * @param imageFileIds - массив OpenAI file IDs изображений для прикрепления
 * @returns ответ от assistant
 */
export async function sendMessageViaAssistant(
  assistantId: string,
  threadId: string,
  message: string,
  imageFileIds: string[] = []
): Promise<string> {
  try {
    // 1. Добавляем сообщение и запускаем run
    const runId = await createMessageAndRun(threadId, assistantId, message, imageFileIds)
    
    // 2. Ожидаем завершения run
    const runStatus = await pollRunStatus(threadId, runId)
    
    if (runStatus.status === 'failed') {
      const errorMsg = runStatus.error?.message || 'Неизвестная ошибка'
      throw new Error(`Assistant завершился с ошибкой: ${errorMsg}`)
    }
    
    if (runStatus.status === 'cancelled' || runStatus.status === 'expired') {
      throw new Error(`Assistant был отменен или истек срок ожидания`)
    }
    
    if (runStatus.status === 'requires_action') {
      // Пока не обрабатываем requires_action (function calling)
      throw new Error(`Assistant требует действия (function calling не реализован)`)
    }
    
    if (runStatus.status !== 'completed') {
      throw new Error(`Неожиданный статус Assistant: ${runStatus.status}`)
    }
    
    // 3. Получаем последнее сообщение
    const response = await getLastMessageFromThread(threadId)
    return response
  } catch (error) {
    console.error('Error sending message via assistant:', error)
    throw error
  }
}

/**
 * Проверяет статус vector store и список файлов в нем
 * @param vectorStoreId - ID vector store
 * @returns информация о vector store и его файлах
 */
export async function checkVectorStoreStatus(vectorStoreId: string): Promise<any> {
  try {
    const response = await fetch(
      `https://api.openai.com/v1/vector_stores/${vectorStoreId}`,
      {
        headers: getAssistantsHeaders(),
      }
    )
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Ошибка получения статуса vector store: ${errorData.error?.message || response.statusText}`)
    }
    
    const vectorStore = await response.json()
    return vectorStore
  } catch (error) {
    console.error('Error checking vector store status:', error)
    throw error
  }
}

/**
 * Получает список файлов в vector store
 * @param vectorStoreId - ID vector store
 * @returns список файлов с их статусами
 */
export async function listVectorStoreFiles(vectorStoreId: string): Promise<any[]> {
  try {
    const response = await fetch(
      `https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`,
      {
        headers: getAssistantsHeaders(),
      }
    )
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Ошибка получения списка файлов: ${errorData.error?.message || response.statusText}`)
    }
    
    const data = await response.json()
    return data.data || []
  } catch (error) {
    console.error('Error listing vector store files:', error)
    throw error
  }
}

/**
 * Удаляет Assistant из OpenAI и из БД
 * @param assistantId - ID Assistant для удаления
 * @param roomId - ID комнаты
 */
export async function deleteAssistant(assistantId: string, roomId: string): Promise<void> {
  try {
    // 1. Удаляем Assistant из OpenAI
    const response = await fetch(
      `https://api.openai.com/v1/assistants/${assistantId}`,
      {
        method: 'DELETE',
        headers: getAssistantsHeaders(),
      }
    )
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      // Если Assistant уже удален - это нормально
      if (response.status !== 404) {
        console.warn('Could not delete assistant from OpenAI:', errorData.error?.message)
      }
    }
    
    // 2. Удаляем запись из БД
    const { error: dbError } = await supabase
      .from('room_assistants')
      .delete()
      .eq('room_id', roomId)
    
    if (dbError) {
      console.warn('Could not delete assistant from DB:', dbError)
    }
    
    console.log('✅ Assistant удален')
  } catch (error) {
    console.error('Error deleting assistant:', error)
    throw error
  }
}

/**
 * Получает или создает Assistant для комнаты
 * @param roomId - ID комнаты
 * @param systemPrompt - системный промпт
 * @param model - модель
 * @param fileIds - массив OpenAI file IDs
 * @returns конфигурация assistant
 */
export async function getOrCreateAssistantForRoom(
  roomId: string,
  systemPrompt: string,
  model: string,
  fileIds: string[] = []
): Promise<AssistantConfig> {
  try {
    // Проверяем, есть ли уже assistant в БД
    const { data: existing, error: selectError } = await supabase
      .from('room_assistants')
      .select('assistant_id, thread_id, created_at, updated_at')
      .eq('room_id', roomId)
      .maybeSingle()  // Используем maybeSingle() вместо single() для корректной обработки отсутствия записи
    
    // Игнорируем ошибки "нет записи" (PGRST116) и 406 (Not Acceptable при пустом результате)
    if (selectError && selectError.code !== 'PGRST116' && selectError.code !== 'PGRST301') {
      // Логируем, но не прерываем выполнение, если это просто отсутствие записи
      if (selectError.message?.includes('Not Acceptable') || selectError.status === 406) {
        console.warn('Supabase returned 406, treating as no existing assistant:', selectError)
      } else {
        console.warn('Error checking existing assistant (non-critical):', selectError)
      }
    }
    
    // Если assistant существует, обновляем его файлы если нужно
    if (existing) {
      // TODO: Реализовать обновление файлов в assistant при необходимости
      // Пока возвращаем существующий
      return {
        assistantId: existing.assistant_id,
        threadId: existing.thread_id,
        roomId,
        lastUpdated: existing.updated_at || existing.created_at,
      }
    }
    
    // Создаем нового assistant
    const assistantId = await createAssistant(systemPrompt, model, fileIds)
    const threadId = await createThread()
    
    // Сохраняем в БД
    const { error: insertError } = await supabase
      .from('room_assistants')
      .insert({
        room_id: roomId,
        assistant_id: assistantId,
        thread_id: threadId,
      })
    
    if (insertError) {
      throw new Error(`Ошибка сохранения assistant в БД: ${insertError.message}`)
    }
    
    return {
      assistantId,
      threadId,
      roomId,
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Error getting or creating assistant for room:', error)
    throw error
  }
}

