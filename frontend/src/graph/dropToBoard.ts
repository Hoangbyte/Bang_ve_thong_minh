import { AssetRecordType, createShapeId, type Editor, type TLAsset, type TLImageShape } from 'tldraw'

/** Thả một ảnh (data URL) vào giữa vùng đang nhìn của bảng. Ảnh là tĩnh: muốn đổi thì thả lại bản mới. */
export function dropImageToBoard(editor: Editor, src: string, mimeType: string, w: number, h: number, name: string, meta?: Record<string, any>) {
  const vp = editor.getViewportPageBounds()
  const dw = Math.min(400, vp.w * 0.6)
  const dh = (dw * h) / w
  const c = vp.center
  const assetId = AssetRecordType.createId()
  const id = createShapeId()
  editor.run(() => {
    editor.createAssets([
      { id: assetId, typeName: 'asset', type: 'image', meta: {}, props: { name, src, w, h, mimeType, isAnimated: false } } as TLAsset,
    ])
    editor.createShape({ id, type: 'image', x: c.x - dw / 2, y: c.y - dh / 2, props: { assetId, w: dw, h: dh }, meta: meta ?? {} })
  })
  editor.select(id)
  return id
}

/** meta lưu công thức và tham số vào hình, để chọn hình rồi "Sửa đồ thị đang chọn". */
export function dropGraphToBoard(editor: Editor, svg: string, w: number, h: number, meta?: Record<string, any>) {
  return dropImageToBoard(editor, `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, 'image/svg+xml', w, h, 'do-thi.svg', meta)
}

/** Thay ảnh đồ thị của hình đang chọn tại chỗ (giữ vị trí và chiều rộng), cập nhật luôn công thức đã lưu. */
export function updateGraphOnBoard(editor: Editor, id: TLImageShape['id'], svg: string, w: number, h: number, meta: Record<string, any>) {
  const shape = editor.getShape(id) as TLImageShape | undefined
  if (!shape || shape.type !== 'image') return false
  const assetId = AssetRecordType.createId()
  editor.run(() => {
    editor.createAssets([
      { id: assetId, typeName: 'asset', type: 'image', meta: {}, props: { name: 'do-thi.svg', src: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, w, h, mimeType: 'image/svg+xml', isAnimated: false } } as TLAsset,
    ])
    editor.updateShape<TLImageShape>({ id, type: 'image', props: { assetId, h: (shape.props.w * h) / w }, meta })
    const old = shape.props.assetId
    const stillUsed = editor.store.allRecords().some((r) => r.typeName === 'shape' && (r as TLImageShape).type === 'image' && r.id !== id && (r as TLImageShape).props.assetId === old)
    if (old && !stillUsed) editor.deleteAssets([old])
  })
  return true
}
