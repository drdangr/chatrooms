/**
 * Утилита для проверки и очистки мокап файлов
 * Можно вызвать из консоли браузера или использовать в коде
 */

import { supabase } from './supabase'

/**
 * Проверяет статус файлов в тестовой комнате
 */
export async function checkTestRoomFiles(roomId?: string) {
  try {
    // Находим тестовую комнату или используем переданную
    let testRoomId = roomId
    
    if (!testRoomId) {
      const { data: rooms, error } = await supabase
        .from('rooms')
        .select('id, title')
        .eq('is_test_room', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (error || !rooms) {
        console.error('Не найдена тестовая комната:', error)
        return
      }
      
      testRoomId = rooms.id
      console.log(`Найдена тестовая комната: ${rooms.title} (${testRoomId})`)
    }
    
    // Получаем все файлы комнаты
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('*')
      .eq('room_id', testRoomId)
      .order('created_at', { ascending: false })
    
    if (filesError) {
      console.error('Ошибка получения файлов:', filesError)
      return
    }
    
    console.log(`\n📊 Статистика файлов:`)
    console.log(`Всего файлов: ${files?.length || 0}`)
    
    const mockFiles = files?.filter(f => f.file_url?.startsWith('mock://')) || []
    const realFiles = files?.filter(f => !f.file_url?.startsWith('mock://')) || []
    const mockWithOpenAI = mockFiles.filter(f => f.openai_file_id)
    const realWithOpenAI = realFiles.filter(f => f.openai_file_id)
    
    console.log(`  - Мокап файлы: ${mockFiles.length}`)
    console.log(`    ⚠️  С openai_file_id: ${mockWithOpenAI.length}`)
    console.log(`  - Реальные файлы: ${realFiles.length}`)
    console.log(`    ✅ С openai_file_id: ${realWithOpenAI.length}`)
    
    if (mockWithOpenAI.length > 0) {
      console.log(`\n⚠️  ПРОБЛЕМА: Найдены мокап файлы с openai_file_id:`)
      mockWithOpenAI.forEach(f => {
        console.log(`  - ${f.filename} (${f.file_url}, openai_file_id: ${f.openai_file_id})`)
      })
    }
    
    // Изображения
    const imageFiles = files?.filter(f => 
      f.file_type?.startsWith('image/') || 
      f.filename.match(/\.(png|jpg|jpeg|gif|webp)$/i)
    ) || []
    
    console.log(`\n🖼️  Изображения:`)
    const mockImages = imageFiles.filter(f => f.file_url?.startsWith('mock://'))
    const realImages = imageFiles.filter(f => !f.file_url?.startsWith('mock://'))
    
    console.log(`  - Мокап изображения: ${mockImages.length}`)
    mockImages.forEach(f => {
      console.log(`    ${f.openai_file_id ? '❌' : '✅'} ${f.filename} (${f.file_url})`)
    })
    
    console.log(`  - Реальные изображения: ${realImages.length}`)
    realImages.forEach(f => {
      console.log(`    ${f.openai_file_id ? '✅' : '⚠️'} ${f.filename} (openai_file_id: ${f.openai_file_id || 'нет'})`)
    })
    
    return {
      totalFiles: files?.length || 0,
      mockFiles: mockFiles.length,
      mockWithOpenAI: mockWithOpenAI.length,
      realFiles: realFiles.length,
      realWithOpenAI: realWithOpenAI.length,
      mockImages: mockImages.length,
      realImages: realImages.length,
      files
    }
  } catch (error) {
    console.error('Ошибка проверки файлов:', error)
  }
}

/**
 * Очищает openai_file_id у мокап файлов
 */
export async function cleanMockFiles(roomId?: string) {
  try {
    // Находим тестовую комнату или используем переданную
    let testRoomId = roomId
    
    if (!testRoomId) {
      const { data: rooms, error } = await supabase
        .from('rooms')
        .select('id, title')
        .eq('is_test_room', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (error || !rooms) {
        console.error('Не найдена тестовая комната:', error)
        return
      }
      
      testRoomId = rooms.id
    }
    
    // Получаем мокап файлы с openai_file_id
    const { data: mockFiles, error: selectError } = await supabase
      .from('files')
      .select('id, filename, openai_file_id, file_url')
      .eq('room_id', testRoomId)
      .like('file_url', 'mock://%')
      .not('openai_file_id', 'is', null)
    
    if (selectError) {
      console.error('Ошибка получения мокап файлов:', selectError)
      return
    }
    
    if (!mockFiles || mockFiles.length === 0) {
      console.log('✅ Нет мокап файлов с openai_file_id для очистки')
      return
    }
    
    console.log(`\n🧹 Найдено ${mockFiles.length} мокап файл(ов) с openai_file_id для очистки:`)
    mockFiles.forEach(f => {
      console.log(`  - ${f.filename} (openai_file_id: ${f.openai_file_id})`)
    })
    
    // Очищаем openai_file_id
    const fileIds = mockFiles.map(f => f.id)
    const { error: updateError } = await supabase
      .from('files')
      .update({ openai_file_id: null })
      .in('id', fileIds)
    
    if (updateError) {
      console.error('❌ Ошибка очистки openai_file_id:', updateError)
      return
    }
    
    console.log(`\n✅ Успешно очищено openai_file_id у ${mockFiles.length} мокап файл(ов)`)
    
    return {
      cleaned: mockFiles.length,
      files: mockFiles
    }
  } catch (error) {
    console.error('Ошибка очистки мокап файлов:', error)
  }
}

// Экспортируем для использования в консоли браузера
if (typeof window !== 'undefined') {
  (window as any).checkMockFiles = checkTestRoomFiles
  ;(window as any).cleanMockFiles = cleanMockFiles
  console.log('💡 Утилиты для работы с мокап файлами доступны:')
  console.log('   - window.checkMockFiles(roomId?) - проверить статус файлов')
  console.log('   - window.cleanMockFiles(roomId?) - очистить openai_file_id у мокап файлов')
}

