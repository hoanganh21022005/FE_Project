import { test, expect } from './helpers/guardedTest.js';
import { loginAs, navigateTo, setupDefaultApiMocks, isApiMatch } from './helpers/mockAuth.js';

// Toàn bộ dữ liệu ở đây là mock (không có Backend thật): kiểm giao diện chatbot hỗ trợ của Member và hộp thư của Lễ tân.
async function setupSupportMocks(page, roleKey = 'member') {
  let activeConversation = null;
  let nextMsgId = 10;
  const messages = [];

  await setupDefaultApiMocks(page, [
    '/api/classes',
    '/api/members',
    '/api/advanced-registrations',
    '/api/specializations',
  ]);

  await page.route((url) => isApiMatch(url, 'chat/me/unread-count'), (r) =>
    r.fulfill({ status: 200, json: { unreadCount: 0 } }),
  );

  await page.route((url) => isApiMatch(url, 'chat/conversations/me/active'), (r) =>
    r.fulfill({ status: 200, json: activeConversation }),
  );

  await page.route((url) => {
    const pathname = new URL(url).pathname;
    return isApiMatch(url, 'chat/conversations') && pathname === '/api/chat/conversations';
  }, (r) => {
    if (r.request().method() === 'POST') {
      const body = r.request().postDataJSON() || {};
      activeConversation = {
        id: 901,
        subject: body.subject || 'Hỗ trợ hội viên',
        status: 'OPEN',
        handlerType: 'AI',
        assignedStaffUserId: null,
        updatedAt: new Date().toISOString(),
      };
      return r.fulfill({ status: 200, json: activeConversation });
    }
    return r.fulfill({
      status: 200,
      json: { content: [], totalElements: 0, totalPages: 1 },
    });
  });

  await page.route((url) => /\/api\/chat\/conversations\/\d+\/messages$/.test(new URL(url).pathname), (r) => {
    if (r.request().method() === 'POST') {
      const body = r.request().postDataJSON() || {};
      const now = new Date().toISOString();
      messages.push({
        id: nextMsgId++,
        senderType: roleKey === 'member' ? 'MEMBER' : 'STAFF',
        senderName: roleKey === 'member' ? 'Hội viên' : 'Lễ tân',
        isMine: true,
        content: body.content || '',
        createdAt: now,
      });
      if (roleKey === 'member') {
        messages.push({
          id: nextMsgId++,
          senderType: 'AI',
          senderName: 'AVT AI',
          isMine: false,
          content: 'Đây là phản hồi mẫu từ trợ lý AVT AI cho câu hỏi của bạn.',
          createdAt: new Date(Date.now() + 500).toISOString(),
        });
      }
      return r.fulfill({ status: 200, json: { ok: true } });
    }
    return r.fulfill({ status: 200, json: messages });
  });

  await page.route((url) => /\/api\/chat\/conversations\/\d+\/read$/.test(new URL(url).pathname), (r) =>
    r.fulfill({ status: 200, json: { ok: true } }),
  );

  await loginAs(page, roleKey);
  await navigateTo(page, '/support');
}

test.describe('Member: giao diện chatbot hỗ trợ (mock)', () => {
  test('Member vào /support thấy bong bóng chào AVT AI và đúng 4 chip trong khung chat', async ({ page }) => {
    await setupSupportMocks(page, 'member');

    await expect(
      page.getByText('Xin chào! Mình là trợ lý AVT AI. Bạn cần hỗ trợ gì hôm nay?'),
    ).toBeVisible();

    const chipContainer = page.getByTestId('support-quick-chips');
    await expect(chipContainer).toBeVisible();
    await expect(chipContainer.locator('button')).toHaveCount(4);
  });

  test('Bấm một chip hiện tin của Member và tin trả lời của AVT AI kèm ảnh đại diện', async ({ page }) => {
    await setupSupportMocks(page, 'member');

    const chipContainer = page.getByTestId('support-quick-chips');
    await chipContainer.locator('button').first().click();

    await expect(
      page.getByText('Hướng dẫn ngắn gọn cách thanh toán và đối soát hóa đơn VNPay tại trung tâm.'),
    ).toBeVisible();
    await expect(
      page.getByText('Đây là phản hồi mẫu từ trợ lý AVT AI cho câu hỏi của bạn.'),
    ).toBeVisible();
    await expect(page.getByTestId('chat-avatar-ai')).toBeVisible();
  });

  test('Vai Lễ tân vào /support không thấy chip trong khung chat và hộp thư hỗ trợ không đổi', async ({ page }) => {
    await setupSupportMocks(page, 'receptionist');

    await expect(page.getByTestId('support-quick-chips')).toHaveCount(0);
    await expect(page.getByText('Xin chào! Bạn cần hỗ trợ gì hôm nay?')).toBeVisible();
    await expect(page.getByText('Chọn một chủ đề hỗ trợ bên phải hoặc nhập câu hỏi vào khung bên dưới để bắt đầu.')).toBeVisible();
  });
});
