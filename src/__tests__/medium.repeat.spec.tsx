import { ChakraProvider, Checkbox, FormControl, FormLabel } from '@chakra-ui/react';
import { render, screen, within, act, renderHook } from '@testing-library/react';
import { UserEvent, userEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { ReactElement } from 'react';

import {
  setupMockHandlerCreation,
  setupMockHandlerDeletion,
  setupMockHandlerUpdating,
} from '../__mocks__/handlersUtils';
import App from '../App';
import { useCalendarView } from '../hooks/useCalendarView';
import { server } from '../setupTests';
import { Event } from '../types';

const setup = (element: ReactElement) => {
  const user = userEvent.setup();

  return { ...render(<ChakraProvider>{element}</ChakraProvider>), user };
};

// ! Hard 여기 제공 안함
const saveSchedule = async (user: UserEvent, form: Omit<Event, 'id' | 'notificationTime'>) => {
  const { title, date, startTime, endTime, location, description, category, repeat } = form;

  await user.click(screen.getAllByText('일정 추가')[0]);

  await user.type(screen.getByLabelText('제목'), title);
  await user.type(screen.getByLabelText('날짜'), date);
  await user.type(screen.getByLabelText('시작 시간'), startTime);
  await user.type(screen.getByLabelText('종료 시간'), endTime);
  await user.type(screen.getByLabelText('설명'), description);
  await user.type(screen.getByLabelText('위치'), location);
  await user.selectOptions(screen.getByLabelText('카테고리'), category);

  await user.selectOptions(screen.getByLabelText('반복 유형'), repeat.type);

  await user.clear(screen.getByLabelText('반복 간격'));
  repeat.interval && (await user.type(screen.getByLabelText('반복 간격'), String(repeat.interval)));
  repeat.endDate && (await user.type(screen.getByLabelText('반복 종료일'), repeat.endDate));

  await user.click(screen.getByTestId('event-submit-button'));
};

describe('(필수) 반복 유형 선택', () => {
  it('일정 생성시 반복 유형을 선택할 수 있다.', async () => {
    setupMockHandlerCreation();

    const { user } = setup(<App />);

    await saveSchedule(user, {
      title: '새 회의',
      date: '2024-10-15',
      startTime: '14:00',
      endTime: '15:00',
      description: '프로젝트 진행 상황 논의',
      location: '회의실 A',
      category: '업무',
      repeat: {
        type: 'weekly',
        interval: 3,
        endDate: '2024-12-01',
      },
    });

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('새 회의')).toBeInTheDocument();
    expect(eventList.getByText('2024-10-15')).toBeInTheDocument();
    expect(eventList.getByText('14:00 - 15:00')).toBeInTheDocument();
    expect(eventList.getByText('프로젝트 진행 상황 논의')).toBeInTheDocument();
    expect(eventList.getByText('회의실 A')).toBeInTheDocument();
    expect(eventList.getByText('카테고리: 업무')).toBeInTheDocument();
    expect(eventList.getByLabelText('반복 정보').innerHTML).toMatchInlineSnapshot(
      `"반복: 3주마다 (종료: 2024-12-01)"`
    );
  });

  it('일정 수정시 반복 유형을 선택할 수 있다.', async () => {
    const { user } = setup(<App />);

    setupMockHandlerUpdating();

    await user.click(await screen.findByLabelText('Edit event'));

    await user.clear(screen.getByLabelText('제목'));
    await user.type(screen.getByLabelText('제목'), '수정된 회의');
    await user.clear(screen.getByLabelText('설명'));
    await user.type(screen.getByLabelText('설명'), '회의 내용 변경');

    await user.click(screen.getByLabelText('반복 일정'));

    await user.selectOptions(screen.getByLabelText('반복 유형'), 'weekly');
    await user.clear(screen.getByLabelText('반복 간격'));
    await user.type(screen.getByLabelText('반복 간격'), '4');
    await user.type(screen.getByLabelText('반복 종료일'), '2025-03-01');

    await user.click(screen.getByTestId('event-submit-button'));

    await act(async () => null);

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('수정된 회의')).toBeInTheDocument();
    expect(eventList.getByText('회의 내용 변경')).toBeInTheDocument();
    expect(eventList.getByLabelText('반복 정보').innerHTML).toMatchInlineSnapshot(
      `"반복: 4주마다 (종료: 2025-03-01)"`
    );
  });
});

describe('(필수) 반복 간격 설정', () => {
  // 2일마다, 3주마다, 2개월마다 등
  it('각 반복 유형에 대해 간격을 설정할 수 있다.', async () => {
    const { user } = setup(<App />);

    setupMockHandlerUpdating();

    const editButton = await screen.findByLabelText('Edit event');
    const submitButton = screen.getByTestId('event-submit-button');

    await user.click(editButton);

    await user.clear(screen.getByLabelText('제목'));
    await user.type(screen.getByLabelText('제목'), '수정된 회의');
    await user.clear(screen.getByLabelText('설명'));
    await user.type(screen.getByLabelText('설명'), '회의 내용 변경');

    await user.click(screen.getByLabelText('반복 일정'));

    await user.selectOptions(screen.getByLabelText('반복 유형'), 'daily');
    await user.clear(screen.getByLabelText('반복 간격'));
    await user.type(screen.getByLabelText('반복 간격'), '2');

    await user.click(submitButton);

    await act(async () => null);

    expect(
      within(screen.getByTestId('event-list')).getByLabelText('반복 정보').innerHTML
    ).toMatchInlineSnapshot(`"반복: 2일마다"`);

    await user.click(editButton);
    await act(async () => null);

    await user.selectOptions(screen.getByLabelText('반복 유형'), 'weekly');
    await user.clear(screen.getByLabelText('반복 간격'));
    await user.type(screen.getByLabelText('반복 간격'), '3');

    await user.click(submitButton);
    await act(async () => null);

    expect(
      within(screen.getByTestId('event-list')).getByLabelText('반복 정보').innerHTML
    ).toMatchInlineSnapshot(`"반복: 3주마다"`);

    await user.click(editButton);
    await act(async () => null);

    await user.selectOptions(screen.getByLabelText('반복 유형'), 'monthly');
    await user.clear(screen.getByLabelText('반복 간격'));
    await user.type(screen.getByLabelText('반복 간격'), '2');

    await user.click(submitButton);
    await act(async () => null);

    expect(
      within(screen.getByTestId('event-list')).getByLabelText('반복 정보').innerHTML
    ).toMatchInlineSnapshot(`"반복: 2월마다"`);
  });
});

describe('(필수) 반복 일정 표시', () => {
  it('캘린더 뷰에서 반복 일정을 시각적으로 구분하여 표시한다. // 아이콘을 넣든 태그를 넣든 자유롭게 해보세요!', async () => {
    const { user } = setup(<App />);

    setupMockHandlerUpdating();

    const editButton = await screen.findByLabelText('Edit event');
    const submitButton = screen.getByTestId('event-submit-button');

    await user.click(editButton);

    await user.clear(screen.getByLabelText('제목'));
    await user.type(screen.getByLabelText('제목'), '수정된 회의');
    await user.clear(screen.getByLabelText('설명'));
    await user.type(screen.getByLabelText('설명'), '회의 내용 변경');

    await user.click(screen.getByLabelText('반복 일정'));

    await user.selectOptions(screen.getByLabelText('반복 유형'), 'daily');
    await user.clear(screen.getByLabelText('반복 간격'));
    await user.type(screen.getByLabelText('반복 간격'), '2');

    await user.click(submitButton);

    await act(async () => null);

    expect(await screen.findByLabelText('RepeatIcon')).not.toBeNull();
  });
});

describe.skip('(필수) 반복 종료', () => {
  it('2025-04-01까지 반복되도록 반복 종료 조건을 지정할 수 있다.', async () => {
    const { user } = setup(<App />);

    setupMockHandlerUpdating();

    const editButton = await screen.findByLabelText('Edit event');
    const submitButton = screen.getByTestId('event-submit-button');

    await user.click(editButton);

    await user.clear(screen.getByLabelText('제목'));
    await user.type(screen.getByLabelText('제목'), '수정된 회의');
    await user.clear(screen.getByLabelText('설명'));
    await user.type(screen.getByLabelText('설명'), '회의 내용 변경');

    await user.click(screen.getByLabelText('반복 일정'));

    await user.selectOptions(screen.getByLabelText('반복 유형'), 'weekly');
    await user.clear(screen.getByLabelText('반복 간격'));
    await user.type(screen.getByLabelText('반복 간격'), '2');
    await user.type(screen.getByLabelText('반복 종료일'), '2025-04-01');

    await user.click(submitButton);

    await act(async () => null);

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('수정된 회의')).toBeInTheDocument();
    expect(eventList.getByText('2025-04-01')).toBeInTheDocument();
  });

  it('3번까지 반복되도록 반복 종료 조건을 지정할 수 있다.', async () => {
    const { user } = setup(<App />);

    setupMockHandlerUpdating();

    const editButton = await screen.findByLabelText('Edit event');
    const submitButton = screen.getByTestId('event-submit-button');

    await user.click(editButton);

    await user.clear(screen.getByLabelText('제목'));
    await user.type(screen.getByLabelText('제목'), '수정된 회의');
    await user.clear(screen.getByLabelText('설명'));
    await user.type(screen.getByLabelText('설명'), '회의 내용 변경');

    await user.click(screen.getByLabelText('반복 일정'));

    await user.selectOptions(screen.getByLabelText('반복 유형'), 'weekly');
    await user.clear(screen.getByLabelText('반복 간격'));
    await user.type(screen.getByLabelText('반복 간격'), '3');
    await user.type(screen.getByLabelText('반복 종료일'), '2025-04-01');

    await user.click(submitButton);

    await act(async () => null);

    const eventList = within(screen.getByTestId('event-list'));
    expect(eventList.getByText('수정된 회의')).toBeInTheDocument();
    expect(eventList.getByText('2025-04-01')).toBeInTheDocument();

    await user.click(editButton);
    await act(async () => null);

    await user.selectOptions(screen.getByLabelText('반복 유형'), 'weekly');
    await user.clear(screen.getByLabelText('반복 간격'));
    await user.type(screen.getByLabelText('반복 간격'), '3');
    
  });

  it('종료 조건 없도록 조건을 지정할 수 있다.', () => {});
});

describe.skip('(필수) 반복 일정 단일 수정', () => {
  it('반복일정을 수정하면 단일 일정으로 변경됩니다.', () => {});
  it('반복일정 아이콘도 사라집니다.', () => {});
});

describe.skip('(필수) 반복 일정 단일 삭제', () => {
  it('반복일정을 삭제하면 해당 일정만 삭제합니다.', () => {});
});
