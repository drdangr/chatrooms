-- Добавляем колонку temperature для хранения температуры модели комнаты
alter table public.rooms
  add column if not exists temperature double precision not null default 1;

