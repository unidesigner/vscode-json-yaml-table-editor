import type { Column, Formatter } from '@slickgrid-universal/common'
import type { ColumnInfo } from '../../shared/tableTypes'
import { TextEditor } from '../editors/textEditor'
import { NumberEditor } from '../editors/numberEditor'
import { BooleanEditor } from '../editors/booleanEditor'
import { EnumEditor } from '../editors/enumEditor'
import { ArrayEditor } from '../editors/arrayEditor'

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function withTooltip(text: string): string {
    if (!text) return ''
    return `<span title="${escapeHtml(text)}">${escapeHtml(text)}</span>`
}

function withWrapAwareContent(text: string, wrapEnabled: boolean): string {
    if (!text) return ''
    if (wrapEnabled) {
        const escaped = escapeHtml(text)
        return `<div class="cell-wrap-content" title="${escaped}">${escaped}</div>`
    }
    return withTooltip(text)
}

function isWrapEnabled(colDef: Column | undefined): boolean {
    return Boolean(colDef && (colDef as any).__wrapEnabled)
}

function appendCssClass(
    existing: string | undefined,
    className: string
): string {
    const classes = new Set((existing ?? '').split(/\s+/).filter(Boolean))
    classes.add(className)
    return Array.from(classes).join(' ')
}

/** Format cell display values */
const defaultFormatter: Formatter = (_row, _cell, value, colDef) => {
    if (value === null || value === undefined) return ''
    const text = Array.isArray(value) ? value.join(', ') : String(value)
    return withWrapAwareContent(text, isWrapEnabled(colDef))
}

const booleanFormatter: Formatter = (_row, _cell, value, colDef) => {
    if (value === null || value === undefined) return ''
    return withWrapAwareContent(value ? 'true' : 'false', isWrapEnabled(colDef))
}

const arrayFormatter: Formatter = (_row, _cell, value, colDef) => {
    const text = Array.isArray(value) ? value.join(', ') : String(value ?? '')
    if (!text) return ''
    return withWrapAwareContent(text, isWrapEnabled(colDef))
}

const arrayOfObjectsFormatter: Formatter = (_row, _cell, value) => {
    const count = Array.isArray(value) ? value.length : 0
    const label = `[${count} item${count === 1 ? '' : 's'}]`
    return `<span class="drilldown-cell" title="Click to drill into array">${escapeHtml(label)} &#9654;</span>`
}

/** Convert a dot-delimited path to a safe SlickGrid column ID */
export function pathToColumnId(path: string): string {
    return path.replace(/\./g, '___')
}

/** Convert a sanitized column ID back to a dot-delimited path */
export function columnIdToPath(id: string): string {
    return id.replace(/___/g, '.')
}

/**
 * Build SlickGrid column definitions from ColumnInfo array.
 * Adds a row number column at position 0.
 */
export function buildColumns(columnInfos: ColumnInfo[]): Column[] {
    // Row number column
    const rowNumCol: Column = {
        id: '__rowNum',
        name: '#',
        field: '__rowIndex',
        width: 50,
        minWidth: 40,
        maxWidth: 80,
        resizable: false,
        selectable: false,
        focusable: false,
        cssClass: 'row-number-cell',
        headerCssClass: 'row-number-header',
        formatter: (_row, _cell, _value, _colDef, dataContext) => {
            return String(
                typeof dataContext.__rowIndex === 'number'
                    ? dataContext.__rowIndex + 1
                    : _row + 1
            )
        }
    }

    const dataCols: Column[] = columnInfos.map((info) => {
        // Ensure minWidth fits the full header label (~8px per char + 24px padding/sort icon)
        const headerMinWidth = Math.max(80, info.label.length * 8 + 24)
        const col: Column = {
            id: pathToColumnId(info.path),
            name: info.label,
            field: info.path,
            minWidth: headerMinWidth,
            width: Math.max(info.preferredWidth ?? 150, headerMinWidth),
            resizable: true,
            sortable: true,
            editor: undefined as any,
            formatter: defaultFormatter
        }

        const wrapEnabled = info.wrapEnabled === true
        ;(col as any).__wrapEnabled = wrapEnabled
        if (wrapEnabled) {
            col.cssClass = appendCssClass(col.cssClass, 'cell-wrap')
        }

        switch (info.type) {
            case 'number':
                col.editor = { model: NumberEditor }
                col.editorClass = NumberEditor as any
                break
            case 'boolean':
                col.editor = { model: BooleanEditor }
                col.editorClass = BooleanEditor as any
                col.formatter = booleanFormatter
                break
            case 'array':
                col.editor = info.enumValues
                    ? {
                          model: ArrayEditor,
                          params: { enumValues: info.enumValues }
                      }
                    : { model: ArrayEditor }
                col.editorClass = ArrayEditor as any
                col.formatter = arrayFormatter
                if (info.enumValues) {
                    ;(col as any).__enumValues = info.enumValues
                }
                break
            case 'arrayOfObjects':
                col.formatter = arrayOfObjectsFormatter
                col.editor = undefined as any
                col.cssClass = appendCssClass(col.cssClass, 'cell-drilldown')
                break
            default:
                if (info.enumValues && info.enumValues.length > 0) {
                    col.editor = {
                        model: EnumEditor,
                        params: { enumValues: info.enumValues }
                    }
                    col.editorClass = EnumEditor as any
                    ;(col as any).__enumValues = info.enumValues
                } else {
                    // Default text editor
                    col.editor = { model: TextEditor }
                    col.editorClass = TextEditor as any
                }
                break
        }

        return col
    })

    return [rowNumCol, ...dataCols]
}
