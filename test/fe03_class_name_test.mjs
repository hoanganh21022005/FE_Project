import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { toClassRequest } from '../src/api/mappers.js'
import { MAX_CLASS_NAME_LENGTH, validateClassName } from '../src/api/classValidation.js'

const managerEnteredName = 'Lớp cầu lông buổi tối'
assert.equal(validateClassName(managerEnteredName), '')
assert.equal(validateClassName('   '), 'Vui lòng nhập tên lớp học.')
assert.match(validateClassName('x'.repeat(MAX_CLASS_NAME_LENGTH + 1)), /255/)

const request = toClassRequest({
  name: managerEnteredName,
  level: 'Nâng cao',
  classType: 'Normal',
})
assert.equal(request.name, managerEnteredName)
assert.equal(request.classType, 'Normal')
assert.equal(Object.hasOwn(request, 'level'), false)

const modalSource = await readFile(new URL('../src/components/modals/NewClassModal.jsx', import.meta.url), 'utf8')
assert.match(modalSource, /id="new-class-name"[\s\S]*?value=\{className\}[\s\S]*?onChange=/)
assert.doesNotMatch(modalSource, /readOnly|CLASS_LEVELS|Tự động sinh chuẩn hóa|Auto-generate class name/)
assert.match(modalSource, /isNormalClassApiCreationBlocked\(apiEnabled\)/)

console.log('PASS: manager-entered class names validate and map unchanged; level is omitted and FE-10 API block remains.')
