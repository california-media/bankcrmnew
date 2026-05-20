import { useEffect, useRef } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

const MODULES = {
  toolbar: [
    [{ header: [2, 3, false] }],
    ['bold', 'italic'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['clean'],
  ],
};

export default function QuillEditor({ value, onChange, style }) {
  const wrapperRef = useRef(null);
  const quillRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    // Capture DOM node now — React 19 clears ref.current before cleanup runs
    const wrapper = wrapperRef.current;
    const container = document.createElement('div');
    wrapper.appendChild(container);

    const quill = new Quill(container, { theme: 'snow', modules: MODULES });
    quillRef.current = quill;
    if (value) quill.clipboard.dangerouslyPasteHTML(value);

    quill.on('text-change', () => {
      const html = quill.root.innerHTML;
      onChangeRef.current(html === '<p><br></p>' ? '' : html);
    });

    return () => {
      quillRef.current = null;
      wrapper.innerHTML = ''; // use captured node, not wrapperRef.current (null in React 19)
    };
  }, []);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;
    if (value !== quill.root.innerHTML) {
      quill.clipboard.dangerouslyPasteHTML(value || '');
    }
  }, [value]);

  return <div ref={wrapperRef} style={{ background: '#fff', ...style }} />;
}
