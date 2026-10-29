import multer from 'multer';
import { HttpError } from '../utils/http-error';

const acceptedMimeTypes = new Set(['image/jpeg', 'image/png', 'application/pdf']);

export const merchantDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
    fields: 12,
    parts: 17,
  },
  fileFilter: (_req, file, callback) => {
    if (!acceptedMimeTypes.has(file.mimetype)) {
      callback(new HttpError(400, 'รองรับเฉพาะไฟล์ PDF, JPG หรือ PNG'));
      return;
    }
    callback(null, true);
  },
}).fields([
  { name: 'storePhoto', maxCount: 1 },
  { name: 'bankProof', maxCount: 1 },
  { name: 'businessRegistration', maxCount: 1 },
  { name: 'companyCertificate', maxCount: 1 },
  { name: 'authorization', maxCount: 1 },
]);
