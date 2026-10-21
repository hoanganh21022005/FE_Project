import { httpClient } from './httpClient.js';
import { mapSubject } from './mappers.js';
import { extractList } from './schemaValidators.js';

const readSubjectList = (data) => {
  const list = extractList(data);
  return Array.isArray(list) ? list.map(mapSubject).filter((subject) => subject.name) : [];
};

export async function getMemberSubjectCatalog() {
  try {
    const data = await httpClient.get('/api/subjects', { notifyForbidden: false, notifyUnauthorized: false });
    return readSubjectList(data);
  } catch (error) {
    if (![401, 403, 404].includes(error?.status)) throw error;
    // The public response currently omits NormalPrice and AdvancedPrice.
    // The member view supplies the published fee table when those values are absent.
    const data = await httpClient.get('/api/public/subjects');
    return readSubjectList(data);
  }
}
