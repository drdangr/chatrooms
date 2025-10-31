import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface PromptSettingsProps {
  roomId: string
  onClose: () => void
}

const AVAILABLE_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (быстрый, дешевый)' },
  { value: 'gpt-4o', label: 'GPT-4o (баланс)' },
  { value: 'gpt-4', label: 'GPT-4 (мощный)' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (старый)' },
]

export default function PromptSettings({ roomId, onClose }: PromptSettingsProps) {
  const [systemPrompt, setSystemPrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadRoom()
  }, [roomId])

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

  const handleSave = async () => {
    if (!roomId) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('rooms')
        .update({
          system_prompt: systemPrompt.trim(),
          model: selectedModel,
          updated_at: new Date().toISOString(),
        })
        .eq('id', roomId)

      if (error) throw error

      console.log('✅ Settings saved successfully:', {
        roomId,
        systemPrompt: systemPrompt.trim(),
        model: selectedModel,
      })

      // Verify the save by reading back
      const { data: savedRoom } = await supabase
        .from('rooms')
        .select('system_prompt, model')
        .eq('id', roomId)
        .single()

      console.log('✅ Verified saved settings:', savedRoom)

      // Trigger custom event to notify ChatRoom about the update
      window.dispatchEvent(new CustomEvent('roomSettingsUpdated', { detail: { roomId } }))
      
      alert('Настройки сохранены!')
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
              {AVAILABLE_MODELS.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Выберите модель для генерации ответов
            </p>
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

        {/* Actions */}
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
      </div>
    </div>
  )
}

