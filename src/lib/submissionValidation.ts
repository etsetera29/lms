/** Verify student uploads before any data is sent to Supabase Storage. */
export const PDF_MIME = 'application/pdf';
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_BYTES = 15 * 1024 * 1024;

/** Returns the canonical MIME type only after validating the file's contents. */
export async function validateSubmissionFile(file: File): Promise<string> {
  if (!file || file.size === 0) throw new Error('Choose a non-empty PDF or DOCX file.');
  if (file.size > MAX_BYTES) throw new Error('Submission files must be 15 MB or smaller.');

  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension !== 'pdf' && extension !== 'docx') {
    throw new Error('Only PDF (.pdf) or Word Document (.docx) files are allowed.');
  }

  // Some mobile browsers return an empty or generic MIME for Office documents.
  // The actual file signature and DOCX package are checked below in all cases.
  const reportedMime = (file.type || '').trim().toLowerCase();
  const acceptedMime = extension === 'pdf'
    ? ['', PDF_MIME, 'application/x-pdf', 'application/octet-stream']
    : ['', DOCX_MIME, 'application/zip', 'application/x-zip-compressed', 'application/octet-stream'];
  if (!acceptedMime.includes(reportedMime)) {
    throw new Error('The selected file MIME type does not match its .'+extension+' extension.');
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (extension === 'pdf') {
    const header = new TextDecoder('ascii').decode(bytes.subarray(0, 8));
    if (!/^%PDF-[12]\.\d/.test(header)) {
      throw new Error('Invalid PDF: its file contents do not contain a PDF signature.');
    }
    const trailer = new TextDecoder('ascii').decode(bytes.subarray(Math.max(0, bytes.length - 2048)));
    if (!trailer.includes('%%EOF')) {
      throw new Error('Invalid PDF: the document appears incomplete or corrupted.');
    }
    return PDF_MIME;
  }

  // DOCX is a ZIP package. Check central-directory entries to reject arbitrary ZIPs.
  const view = new DataView(buffer);
  if (bytes.length < 22 || view.getUint32(0, true) !== 0x04034b50) {
    throw new Error('Invalid DOCX: this file is not a Word document package.');
  }
  const lowerBound = Math.max(0, bytes.length - 65557);
  let end = -1;
  for (let p = bytes.length - 22; p >= lowerBound; p--) {
    if (view.getUint32(p, true) === 0x06054b50 && p + 22 + view.getUint16(p+20,true) === bytes.length) {
      end = p; break;
    }
  }
  if (end < 0) throw new Error('Invalid DOCX: the document package is incomplete.');
  const count = view.getUint16(end+10, true);
  const directorySize = view.getUint32(end+12, true);
  const directoryOffset = view.getUint32(end+16, true);
  if (count < 2 || count === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff || directoryOffset + directorySize > end) {
    throw new Error('Invalid DOCX: the document directory is corrupt.');
  }
  const decoder = new TextDecoder('utf-8');
  let offset = directoryOffset;
  let hasTypes = false, hasDocument = false, hasRootRels = false, hasMacros = false;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset,true) !== 0x02014b50) {
      throw new Error('Invalid DOCX: the document directory contains invalid entries.');
    }
    const nameLen = view.getUint16(offset + 28,true);
    const extraLen = view.getUint16(offset + 30,true);
    const commentLen = view.getUint16(offset + 32,true);
    const localOffset = view.getUint32(offset + 42,true);
    if (offset + 46 + nameLen + extraLen + commentLen > end || localOffset + 4 > bytes.length || view.getUint32(localOffset,true) !== 0x04034b50) {
      throw new Error('Invalid DOCX: the package entries are damaged.');
    }
    const name = decoder.decode(bytes.subarray(offset+46,offset+46+nameLen));
    hasTypes ||= name === '[Content_Types].xml';
    hasDocument ||= name === 'word/document.xml';
    hasRootRels ||= name === '_rels/.rels';
    hasMacros ||= name.toLowerCase() === 'word/vbaproject.bin';
    offset += 46 + nameLen + extraLen + commentLen;
  }
  if (offset !== directoryOffset + directorySize || !hasTypes || !hasDocument || !hasRootRels || hasMacros) {
    throw new Error('Invalid DOCX: upload a genuine macro-free Microsoft Word .docx document.');
  }
  return DOCX_MIME;
}
