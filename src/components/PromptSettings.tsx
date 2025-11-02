import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import RoleManagement from './RoleManagement'
import { listOpenAIModels } from '../lib/openai'

interface PromptSettingsProps {
  roomId: string
  onClose: () => void
}

interface ModelOption {
  value: string
  label: string
  verified?: boolean
}

const DEFAULT_MODELS: ModelOption[] = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (быстрый, дешевый)', verified: true },
  { value: 'gpt-4o', label: 'GPT-4o (баланс)', verified: true },
  { value: 'gpt-4', label: 'GPT-4 (мощный)', verified: true },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (старый)', verified: true },
  { value: 'gpt-4.5-turbo', label: 'GPT-4.5 Turbo (нужен доступ)', verified: false },
  { value: 'gpt-4.5', label: 'GPT-4.5 (нужен доступ)', verified: false },
  { value: 'o1', label: 'O1 (reasoning, мощный) ✅', verified: true },
]

function mergeModelOptions(base: ModelOption[], extra: ModelOption[] = []): ModelOption[] {
  const map = new Map<string, ModelOption>()
  base.forEach((option) => {
    map.set(option.value, option)
  })

  extra.forEach((option) => {
    if (!map.has(option.value)) {
      map.set(option.value, option)
    }
  })

  return Array.from(map.values())
}

export default function PromptSettings({ roomId, onClose }: PromptSettingsProps) {
  const [systemPrompt, setSystemPrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'settings' | 'roles'>('settings')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [dynamicModelOptions, setDynamicModelOptions] = useState<ModelOption[]>([])
  const [apiModels, setApiModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [customModel, setCustomModel] = useState('')

  useEffect(() => {
    loadRoom()
    loadCurrentUser()
  }, [roomId])

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id || null)
  }

  const loadRoom = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single()

      if (error) throw error

      setSystemPrompt(data.system_prompt || '')
      setSelectedModel(data.model || 'gpt-4o-mini')
    } catch (error) {
      console.error('Error loading room:', error)
      alert('Ошибка загрузки настроек комнаты')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedModel) return

    const isDefault = DEFAULT_MODELS.some((model) => model.value === selectedModel)
    setDynamicModelOptions((prev) => {
      if (isDefault || prev.some((model) => model.value === selectedModel)) {
        return prev
      }

      return [...prev, { value: selectedModel, label: `${selectedModel} (из БД)`, verified: false }]
    })
  }, [selectedModel])

  const combinedModelOptions = useMemo(
    () => mergeModelOptions(DEFAULT_MODELS, dynamicModelOptions),
    [dynamicModelOptions]
  )

  const loadModelsFromApi = async () => {
    setLoadingModels(true)
    setModelsError(null)

    try {
      const models = await listOpenAIModels()
      const filtered = models.filter((id) =>
        id.startsWith('gpt-') ||
        id.startsWith('chatgpt') ||
        id.startsWith('o1') ||
        id.startsWith('o3')
      )

      const newOptions: ModelOption[] = filtered.map((id) => ({
        value: id,
        label: `${id} (из API)`
      }))

      setApiModels(filtered.sort())
      setDynamicModelOptions((prev) => mergeModelOptions(prev, newOptions))
    } catch (error) {
      setModelsError((error as Error).message)
    } finally {
      setLoadingModels(false)
    }
  }

  const handleApplyCustomModel = () => {
    const trimmed = customModel.trim()
    if (!trimmed) return

    setSelectedModel(trimmed)
    setDynamicModelOptions((prev) => {
      if (
        DEFAULT_MODELS.some((model) => model.value === trimmed) ||
        prev.some((model) => model.value === trimmed)
      ) {
        return prev
      }

      return [...prev, { value: trimmed, label: `${trimmed} (кастом)`, verified: false }]
    })
  }

  const isO1ModelSelected = selectedModel?.startsWith('o1') || selectedModel?.startsWith('o3')
  const isGpt45Selected = selectedModel?.includes('4.5')

  const handleSave = async () => {
    if (!roomId) return

    setSaving(true)
    try {
      // Get current user to verify permissions
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('User not authenticated')
      }

      console.log('💾 Attempting to save settings:', {
        roomId,
        userId: user.id,
        systemPrompt: systemPrompt.trim(),
        model: selectedModel,
      })

      // First, check if user can update this room
      const { data: existingRoom, error: checkError } = await supabase
        .from('rooms')
        .select('id, created_by, system_prompt, model')
        .eq('id', roomId)
        .single()

      if (checkError) {
        throw new Error(`Cannot access room: ${checkError.message}`)
      }

      console.log('📋 Current room data:', existingRoom)
      console.log('👤 Current user ID:', user.id)
      console.log('🏠 Room created by:', existingRoom.created_by)
      console.log('🔐 Can update?', existingRoom.created_by === user.id)

      if (existingRoom.created_by !== user.id) {
        // Check if RLS policy allows update for all authenticated users
        console.log('⚠️ User did not create room, but will try to update (RLS may allow)')
      }

      // Perform the update with explicit error handling
      const updateData = {
        system_prompt: systemPrompt.trim(),
        model: selectedModel,
        updated_at: new Date().toISOString(),
      }

      console.log('📝 Executing UPDATE with data:', updateData)

      const { data: updateResult, error } = await supabase
        .from('rooms')
        .update(updateData)
        .eq('id', roomId)
        .select() // Return updated row

      if (error) {
        console.error('❌ Update error:', error)
        console.error('❌ Error code:', error.code)
        console.error('❌ Error message:', error.message)
        console.error('❌ Error details:', JSON.stringify(error, null, 2))
        console.error('❌ Error hint:', error.hint)
        
        if (error.code === 'PGRST301' || error.message?.includes('permission') || error.message?.includes('policy')) {
          console.error('❌ RLS POLICY ERROR: User may not have permission to update this room')
          throw new Error(`Нет прав на обновление комнаты. Вы должны быть создателем комнаты. Ошибка: ${error.message}`)
        }
        
        throw error
      }

      if (!updateResult || updateResult.length === 0) {
        console.error('❌ Update returned no rows - update may have been blocked by RLS')
        throw new Error('Обновление не выполнено. Проверьте права доступа к комнате.')
      }

      console.log('✅ Update result:', updateResult)
      console.log('✅ Update result prompt:', updateResult[0]?.system_prompt)
      console.log('✅ Expected prompt:', systemPrompt.trim())
      console.log('✅ Match?', updateResult[0]?.system_prompt === systemPrompt.trim())

      console.log('✅ Settings saved successfully:', {
        roomId,
        systemPrompt: systemPrompt.trim(),
        model: selectedModel,
        timestamp: new Date().toISOString(),
        updateResult: updateResult?.[0],
      })

      // Verify the save by reading back
      const { data: savedRoom, error: verifyError } = await supabase
        .from('rooms')
        .select('system_prompt, model, updated_at, created_by')
        .eq('id', roomId)
        .single()

      if (verifyError) {
        console.error('❌ Error verifying saved settings:', verifyError)
      } else {
        console.log('✅ Verified saved settings in DB:', savedRoom)
        console.log('🔍 Comparison:', {
          saved: savedRoom.system_prompt,
          expected: systemPrompt.trim(),
          match: savedRoom.system_prompt === systemPrompt.trim(),
        })
        
        if (savedRoom.system_prompt !== systemPrompt.trim()) {
          console.error('❌ MISMATCH! Saved prompt does not match what we tried to save!')
          console.error('❌ Expected:', systemPrompt.trim())
          console.error('❌ Got:', savedRoom.system_prompt)
        } else {
          console.log('✅ Verified: Saved prompt matches expected value')
        }
        
        console.log('✅ This should trigger Realtime UPDATE event for other clients')
      }

      // CRITICAL: Verify one more time before closing
      const { data: finalCheck } = await supabase
        .from('rooms')
        .select('system_prompt, model')
        .eq('id', roomId)
        .single()

      console.log('🔍 Final verification before closing:', {
        expected: systemPrompt.trim(),
        actual: finalCheck?.system_prompt,
        matches: finalCheck?.system_prompt === systemPrompt.trim(),
      })

      if (finalCheck?.system_prompt !== systemPrompt.trim()) {
        console.error('❌ CRITICAL: Prompt mismatch detected before closing modal!')
        console.error('❌ This suggests the update was rolled back or overwritten')
        alert(`Ошибка: промпт не сохранился! Ожидалось: "${systemPrompt.trim()}", получено: "${finalCheck?.system_prompt}"`)
        setSaving(false)
        return
      }

      // Wait a bit to ensure DB transaction is committed and Realtime event is propagated
      // Longer delay to ensure Realtime has time to broadcast to all clients
      console.log('⏳ Waiting 1.5 seconds for Realtime propagation...')
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Trigger custom event to notify ChatRoom about the update (local)
      // But only if we're sure the save was successful
      window.dispatchEvent(new CustomEvent('roomSettingsUpdated', { detail: { roomId } }))
      
      console.log('📤 Settings saved and local event triggered. Realtime event should be broadcast to other clients now.')
      
      onClose()
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Ошибка при сохранении настроек: ' + (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
          <div className="text-center">Загрузка настроек...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-2xl font-bold mb-4">Настройки комнаты</h3>

        {/* Tabs */}
        <div className="flex border-b mb-4">
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === 'settings'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Настройки
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === 'roles'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Роли
          </button>
        </div>

        {activeTab === 'settings' ? (
        <div className="space-y-6">
          {/* Model Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Модель LLM
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {combinedModelOptions.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                  {!model.verified ? ' ⚠️' : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Выберите модель для генерации ответов
            </p>
            {isO1ModelSelected && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-xs text-green-800 font-semibold mb-1">
                  ℹ️ Особенности моделей O1/O3
                </p>
                <ul className="text-xs text-green-700 space-y-1 list-disc list-inside">
                  <li>Системный промпт автоматически встраивается в первое пользовательское сообщение</li>
                  <li>Параметр temperature игнорируется (модель управляет стилем сама)</li>
                  <li>Убедитесь, что ваш API ключ имеет доступ к reasoning моделям</li>
                </ul>
              </div>
            )}
            {isGpt45Selected && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800 font-semibold mb-1">
                  ℹ️ Особенности моделей GPT-4.5
                </p>
                <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                  <li>Нужен активированный доступ в OpenAI (часто доступно только в тарифах Pro)</li>
                  <li>Проверьте актуальное имя модели через API (кнопка ниже)</li>
                  <li>В случае ошибки попробуйте GPT-4o как fallback</li>
                </ul>
              </div>
            )}

            <div className="mt-4 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={loadModelsFromApi}
                  disabled={loadingModels}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors text-sm font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loadingModels ? 'Загрузка моделей...' : 'Загрузить модели из OpenAI'}
                </button>
                {modelsError && (
                  <span className="text-xs text-red-600">
                    Ошибка загрузки моделей: {modelsError}
                  </span>
                )}
              </div>

              {apiModels.length > 0 && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-xs text-purple-800 font-semibold mb-2">
                    Найденные модели (нажмите, чтобы выбрать):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {apiModels.map((model) => (
                      <button
                        key={model}
                        type="button"
                        onClick={() => setSelectedModel(model)}
                        className={`px-2 py-1 text-xs rounded border transition-colors ${
                          selectedModel === model
                            ? 'bg-purple-500 text-white border-purple-600'
                            : 'bg-white text-purple-700 border-purple-300 hover:bg-purple-100'
                        }`}
                        title="Использовать эту модель"
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Указать своё имя модели
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="Например, gpt-4.5-preview"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCustomModel}
                    className="px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors text-sm font-semibold"
                  >
                    Применить
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Если модель недоступна в списке, введите её точное имя вручную
                </p>
              </div>
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Системный промпт
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Вы - полезный ассистент. Помогайте пользователям с их вопросами."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[200px] font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Промпт определяет роль и поведение LLM в этой комнате. Вы можете указать,
              какую роль должен играть ассистент (например, "Ты - опытный программист"
              или "Ты - креативный писатель").
            </p>
          </div>

          {/* Example Prompts */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm font-semibold text-gray-700 mb-2">
              Примеры промптов:
            </p>
            <div className="space-y-2 text-xs text-gray-600">
              <button
                onClick={() => setSystemPrompt('Ты - опытный программист и ментор. Помогай с кодом, объясняй сложные концепции простым языком.')}
                className="block text-left hover:text-blue-600 underline"
              >
                📝 Программист-ментор
              </button>
              <button
                onClick={() => setSystemPrompt('Ты - креативный писатель. Помогай с написанием текстов, редактированием и идеями для историй.')}
                className="block text-left hover:text-blue-600 underline"
              >
                ✍️ Креативный писатель
              </button>
              <button
                onClick={() => setSystemPrompt('Ты - ГМ (Game Master) для настольной ролевой игры. Создавай интересные сценарии, управляй миром и персонажами.')}
                className="block text-left hover:text-blue-600 underline"
              >
                🎲 Game Master
              </button>
            </div>
          </div>
        </div>
        ) : (
          currentUserId ? (
            <RoleManagement roomId={roomId} currentUserId={currentUserId} />
          ) : (
            <div className="text-center py-4 text-gray-500">Загрузка...</div>
          )
        )}

        {/* Actions */}
        {activeTab === 'settings' && (
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-6 py-3 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition-colors disabled:bg-gray-200 font-semibold"
            >
              Отмена
            </button>
          </div>
        )}
        
        {activeTab === 'roles' && (
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition-colors font-semibold"
            >
              Закрыть
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

