import {fetchPost} from "../util/fetch";
import {setPosition} from "../util/setPosition";
import {hasClosestByAttribute, hasClosestByClassName} from "../protyle/util/hasClosest";
import {setStorageVal, writeText} from "../protyle/util/compatibility";
import {getAllModels} from "../layout/getAll";
import {focusByRange} from "../protyle/util/selection";
import {Constants} from "../constants";
import {Dialog} from "../dialog";
import {showMessage} from "../dialog/message";
import {isMobile} from "../util/functions";
import {confirmDialog} from "../dialog/confirmDialog";
import {filesize} from "filesize";

export const initAnno = (element: HTMLElement, pdf: any) => {
    getConfig(pdf);
    const pdfConfig = pdf.appConfig;
    const rectAnnoElement = pdfConfig.toolbar.rectAnno;
    rectAnnoElement.addEventListener("click", () => {
        if (rectAnnoElement.classList.contains("toggled")) {
            rectAnnoElement.classList.remove("toggled");
            pdfConfig.mainContainer.classList.remove("rect-to-annotation");
        } else {
            pdf.pdfCursorTools.switchTool(0);
            rectAnnoElement.classList.add("toggled");
            pdfConfig.mainContainer.classList.add("rect-to-annotation");
            // 开启框选时清理手写/擦除状态，保证三种模式互斥
            if (pdfConfig.toolbar.inkAnno) {
                pdfConfig.toolbar.inkAnno.classList.remove("toggled");
                pdfConfig.mainContainer.classList.remove("ink-to-annotation");
            }
            if (pdfConfig.toolbar.inkErase) {
                pdfConfig.toolbar.inkErase.classList.remove("toggled");
                pdfConfig.mainContainer.classList.remove("ink-erase-annotation");
            }
            if (getSelection().rangeCount > 0) {
                getSelection().getRangeAt(0).collapse(true);
            }
            hideToolbar(element);
        }
    });
    const rectResizeElement = pdfConfig.mainContainer.lastElementChild;
    pdfConfig.mainContainer.addEventListener("mousedown", (event: MouseEvent) => {
        if (event.button === 2 || !rectAnnoElement.classList.contains("toggled")) {
            // 右键
            return;
        }
        let canvasRect = pdf.pdfViewer._getVisiblePages().first.view.canvas.getBoundingClientRect();
        if (event.clientX > canvasRect.right) {
            canvasRect = pdf.pdfViewer._getVisiblePages().last.view.canvas.getBoundingClientRect();
        }
        const containerRet = pdfConfig.mainContainer.getBoundingClientRect();
        const mostLeft = canvasRect.left;
        const mostRight = canvasRect.right;
        const mostBottom = containerRet.bottom;
        let x = event.clientX;
        if (event.clientX > mostRight) {
            x = mostRight;
        } else if (event.clientX < mostLeft) {
            x = mostLeft;
        }
        const mostTop = containerRet.top;
        const y = event.clientY;
        const documentSelf = document;
        documentSelf.onmousemove = (moveEvent) => {
            rectResizeElement.classList.remove("fn__none");
            let newTop = 0;
            let newLeft = 0;
            let newWidth = 0;
            let newHeight = 0;
            if (moveEvent.clientX < x) {
                if (moveEvent.clientX < mostLeft) {
                    // 向左越界
                    newLeft = mostLeft;
                } else {
                    // 向左
                    newLeft = moveEvent.clientX;
                }
                newWidth = x - newLeft;
            } else {
                if (moveEvent.clientX > mostRight) {
                    // 向右越界
                    newLeft = x;
                    newWidth = mostRight - newLeft;
                } else {
                    // 向右
                    newLeft = x;
                    newWidth = moveEvent.clientX - x;
                }
            }

            if (moveEvent.clientY > y) {
                if (moveEvent.clientY > mostBottom) {
                    // 向下越界
                    newTop = y;
                    newHeight = mostBottom - y;
                } else {
                    // 向下
                    newTop = y;
                    newHeight = moveEvent.clientY - y;
                }
            } else {
                if (moveEvent.clientY < mostTop) {
                    // 向上越界
                    newTop = mostTop;
                } else {
                    // 向上
                    newTop = moveEvent.clientY;
                }
                newHeight = y - newTop;
            }
            rectResizeElement.setAttribute("style",
                `top:${newTop}px;height:${newHeight}px;left:${newLeft}px;width:${newWidth}px;background-color:${moveEvent.altKey ? "var(--b3-pdf-background1)" : ""}`);
        };
        documentSelf.onmouseup = () => {
            documentSelf.onmousemove = null;
            documentSelf.onmouseup = null;
            documentSelf.ondragstart = null;
            documentSelf.onselectstart = null;
            documentSelf.onselect = null;
            rectAnnoElement.classList.remove("toggled");
            pdfConfig.mainContainer.classList.remove("rect-to-annotation");

            const coords = getHightlightCoordsByRect(pdf, window.siyuan.storage[Constants.LOCAL_PDFTHEME].annoColor || "var(--b3-pdf-background1)", rectResizeElement,
                rectResizeElement.style.backgroundColor ? "text" : "border");
            rectResizeElement.classList.add("fn__none");
            if (coords) {
                coords.forEach((item, index) => {
                    const newElement = showHighlight(item, pdf);
                    if (index === 0) {
                        rectElement = newElement;
                        copyAnno(`${pdf.appConfig.file.replace(location.origin, "").substr(1)}/${rectElement.getAttribute("data-node-id")}`,
                            pdf.appConfig.file.replace(location.origin, "").substr(8).replace(/-\d{14}-\w{7}.pdf$/, ""), pdf);
                    }
                });
            } else {
                rectElement = null;
            }
        };
    });
    element.firstElementChild.addEventListener("click", (event: MouseEvent) => {
        let processed = false;
        let target = event.target as HTMLElement;
        if (typeof event.detail === "string") {
            window.siyuan.storage[Constants.LOCAL_PDFTHEME].annoColor = event.detail === "0" ?
                (window.siyuan.storage[Constants.LOCAL_PDFTHEME].annoColor || "var(--b3-pdf-background1)")
                : `var(--b3-pdf-background${event.detail})`;
            setStorageVal(Constants.LOCAL_PDFTHEME, window.siyuan.storage[Constants.LOCAL_PDFTHEME]);
            const coords = getHightlightCoordsByRange(pdf, window.siyuan.storage[Constants.LOCAL_PDFTHEME].annoColor);
            if (coords) {
                coords.forEach((item, index) => {
                    const newElement = showHighlight(item, pdf);
                    if (index === 0) {
                        rectElement = newElement;
                        copyAnno(`${pdf.appConfig.file.replace(location.origin, "").substr(1)}/${rectElement.getAttribute("data-node-id")}`,
                            pdf.appConfig.file.replace(location.origin, "").substr(8).replace(/-\d{14}-\w{7}.pdf$/, ""), pdf);
                    }
                });
            }
            hideToolbar(element);
            return;
        }
        while (target && !target.classList.contains("pdf__outer")) {
            const type = target.getAttribute("data-type");
            if (target.classList.contains("color__square")) {
                const color = target.style.backgroundColor;
                window.siyuan.storage[Constants.LOCAL_PDFTHEME].annoColor = color;
                setStorageVal(Constants.LOCAL_PDFTHEME, window.siyuan.storage[Constants.LOCAL_PDFTHEME]);
                if (rectElement) {
                    const config = getConfig(pdf);
                    const annoItem = config[rectElement.getAttribute("data-node-id")];
                    annoItem.color = color;
            element.querySelectorAll(`.pdf__rect[data-node-id="${rectElement.getAttribute("data-node-id")}"]`).forEach(rectItem => {
                Array.from(rectItem.children).forEach((item: HTMLElement) => {
                    item.style.border = "2px solid " + color;
                    if (annoItem.type === "text") {
                        item.style.backgroundColor = color;
                    } else {
                        item.style.backgroundColor = "transparent";
                    }
                });
            });
            if (annoItem.type === "ink") {
                // 跨页笔迹需要重绘其涉及的每一页
                (annoItem.inkPages || []).forEach((inkPage: { index: number }) => {
                    renderInkPage(pdf, inkPage.index);
                });
            }
            fetchPost("/api/asset/setFileAnnotation", {
                        path: pdf.appConfig.file.replace(location.origin, "").substr(1) + ".sya",
                        data: JSON.stringify(config),
                    });
                } else {
                    const coords = getHightlightCoordsByRange(pdf, color);
                    if (coords) {
                        coords.forEach((item, index) => {
                            const newElement = showHighlight(item, pdf);
                            if (index === 0) {
                                rectElement = newElement;
                                copyAnno(`${pdf.appConfig.file.replace(location.origin, "").substr(1)}/${rectElement.getAttribute("data-node-id")}`,
                                    pdf.appConfig.file.replace(location.origin, "").substr(8).replace(/-\d{14}-\w{7}.pdf$/, ""), pdf);
                            }
                        });
                    }
                }
                hideToolbar(element);
                processed = true;
                event.preventDefault();
                event.stopPropagation();
                break;
        } else if (target.classList.contains("pdf__rect") || target.classList.contains("pdf__ink")) {
            showToolbar(element, undefined, target);
                event.preventDefault();
                event.stopPropagation();
                processed = true;
                break;
            } else if (type === "remove") {
                const urlPath = pdf.appConfig.file.replace(location.origin, "").substr(1);
                const config = getConfig(pdf);
                const id = rectElement.getAttribute("data-node-id");
                delete config[id];
                element.querySelectorAll(`[data-node-id="${id}"]`).forEach(item => {
                    item.remove();
                });
                fetchPost("/api/asset/setFileAnnotation", {
                    path: urlPath + ".sya",
                    data: JSON.stringify(config),
                });
                hideToolbar(element);
                event.preventDefault();
                event.stopPropagation();
                processed = true;
                break;
            } else if (type === "copy") {
                hideToolbar(element);
                copyAnno(`${pdf.appConfig.file.replace(location.origin, "").substr(1)}/${rectElement.getAttribute("data-node-id")}`,
                    pdf.appConfig.file.replace(location.origin, "").substr(8).replace(/-\d{14}-\w{7}.pdf$/, ""), pdf);
                event.preventDefault();
                event.stopPropagation();
                processed = true;
                break;
            } else if (type === "relate") {
                setRelation(pdf);
                hideToolbar(element);
                event.preventDefault();
                event.stopPropagation();
                processed = true;
                break;
        } else if (type === "toggle") {
            const config = getConfig(pdf);
            const annoItem = config[rectElement.getAttribute("data-node-id")];
            if (annoItem.type === "border") {
                    annoItem.type = "text";
                } else {
                    annoItem.type = "border";
                }
                element.querySelectorAll(`.pdf__rect[data-node-id="${rectElement.getAttribute("data-node-id")}"]`).forEach(rectItem => {
                    Array.from(rectItem.children).forEach((item: HTMLElement) => {
                        if (annoItem.type === "text") {
                            item.style.backgroundColor = item.style.border.replace("2px solid ", "");
                        } else {
                            item.style.backgroundColor = "";
                        }
                    });
                });
                fetchPost("/api/asset/setFileAnnotation", {
                    path: pdf.appConfig.file.replace(location.origin, "").substr(1) + ".sya",
                    data: JSON.stringify(config),
                });
                event.preventDefault();
                event.stopPropagation();
                processed = true;
                hideToolbar(element);
                break;
            }
            target = target.parentElement;
        }

        if (processed) {
            return;
        }

        // 笔迹很细，按下与抬起可能落在不同元素上，click 会派发到共同祖先，从而走到下面的隐藏逻辑，
        // 这里跳过一次隐藏，避免刚在 mousedown 弹出的手写标注菜单立即被关掉
        if (inkToolbarShown) {
            inkToolbarShown = false;
            return;
        }

        setTimeout(() => {
            let isShow = false;
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                if (range.toString() !== "" &&
                    hasClosestByClassName(range.commonAncestorContainer, "pdfViewer")) {
                    showToolbar(element, range);
                    isShow = true;
                }
            }
            if (!isShow) {
                hideToolbar(element);
            }
        });
    });
    // 手写标注在按下时就弹出操作菜单：笔迹位于文本层之上，按下后浏览器会开始文本选区并重绘，
    // 首次 click 事件可能不会派发到笔迹上，导致需要点两次，这里提前到 mousedown 处理
    element.firstElementChild.addEventListener("mousedown", (event: MouseEvent) => {
        inkToolbarShown = false;
        if (event.button !== 0 || pdfConfig.mainContainer.classList.contains("rect-to-annotation")) {
            return;
        }
        const inkElement = hasClosestByClassName(event.target as HTMLElement, "pdf__ink");
        if (!inkElement || inkElement.classList.contains("pdf__ink--draft")) {
            return;
        }
        showToolbar(element, undefined, inkElement as HTMLElement);
        inkToolbarShown = true;
        event.preventDefault();
        event.stopPropagation();
    });
    return pdf;
};

const getRelationHTML = (ids: string[]) => {
    if (!ids) {
        return `<li class="b3-list--empty">${window.siyuan.languages.emptyContent}</li>`;
    }
    let html = "";
    ids.forEach((id: string) => {
        html += `<li data-id="${id}" class="popover__block b3-list-item b3-list-item--narrow b3-list-item--hide-action">
    <span class="b3-list-item__text">${id}</span>
    <span data-type="clear" class="b3-tooltips b3-tooltips__w b3-list-item__action" aria-label="${window.siyuan.languages.delete}">
        <svg><use xlink:href="#iconTrashcan"></use></svg>
    </span>
</li>`;
    });
    return html;
};

const setRelation = (pdf: any) => {
    const config = getConfig(pdf);
    const configItem = config[rectElement.getAttribute("data-node-id")];
    if (!configItem.ids) {
        configItem.ids = [];
    }
    const dialog = new Dialog({
        title: window.siyuan.languages.relation,
        content: `<div class="b3-dialog__content">
    <div class="fn__flex">
        <input class="b3-text-field fn__flex-1" placeholder="${window.siyuan.languages.fileAnnoRefPlaceholder}">
        <div class="fn__space"></div>
        <button class="b3-button b3-button--text" data-type="add">${window.siyuan.languages.addAttr}</button>
    </div>
    <div class="fn__hr"></div>
    <ul class="b3-list b3-list--background">${getRelationHTML(configItem.ids)}</ul>
</div>`,
        width: isMobile() ? "92vw" : "520px",
    });

    // 跨页手写标注在多个页面各有一个元素，需要同步更新它们的关联属性
    const syncRelationAttr = (ids: string[]) => {
        const id = rectElement.getAttribute("data-node-id");
        pdf.appConfig.appContainer.querySelectorAll(`[data-node-id="${id}"]`).forEach((item: Element) => {
            item.setAttribute("data-relations", ids.join(","));
        });
    };

    const addRelation = () => {
        if (/\d{14}-\w{7}/.test(inputElement.value)) {
            if (!configItem.ids.includes(inputElement.value)) {
                configItem.ids.push(inputElement.value);
                updateRelation(pdf, config);
                syncRelationAttr(configItem.ids);
                dialog.element.querySelector(".b3-list").innerHTML = getRelationHTML(configItem.ids);
            }
            inputElement.value = "";
        } else {
            showMessage("ID " + window.siyuan.languages.invalid);
        }
    };

    const updateRelation = (pdf: any, config: any) => {
        fetchPost("/api/asset/setFileAnnotation", {
            path: pdf.appConfig.file.replace(location.origin, "").substr(1) + ".sya",
            data: JSON.stringify(config),
        });
    };

    const inputElement = dialog.element.querySelector(".b3-text-field") as HTMLInputElement;
    inputElement.focus();
    inputElement.addEventListener("keydown", (event) => {
        if (event.isComposing) {
            return;
        }
        if (event.key === "Enter") {
            addRelation();
        }
    });
    dialog.element.addEventListener("click", (event) => {
        let target = event.target as HTMLElement;
        while (target && !target.classList.contains("b3-dialog__content")) {
            const type = target.getAttribute("data-type");
            if (type === "add") {
                addRelation();
                event.preventDefault();
                event.stopPropagation();
                break;
            } else if (type === "clear") {
                configItem.ids.splice(configItem.ids.indexOf(target.parentElement.textContent.trim()), 1);
                updateRelation(pdf, config);
                syncRelationAttr(configItem.ids);
                dialog.element.querySelector(".b3-list").innerHTML = getRelationHTML(configItem.ids);
            }
            target = target.parentElement;
        }
    });
};

const hideToolbar = (element: HTMLElement) => {
    element.querySelector(".pdf__util").classList.add("fn__none");
};

let rectElement: HTMLElement;
// 手写标注菜单是否刚在 mousedown 中弹出，用于让紧随其后的 click 跳过一次隐藏
let inkToolbarShown = false;
const showToolbar = (element: HTMLElement, range: Range, target?: HTMLElement) => {
    if (target) {
        // 阻止 popover
        target.setAttribute("prevent-popover", "true");
        setTimeout(() => {
            target.removeAttribute("prevent-popover");
        }, 620);
    }

    const utilElement = element.querySelector(".pdf__util") as HTMLElement;
    utilElement.classList.remove("fn__none");

    if (range) {
        utilElement.classList.add("pdf__util--hide");
        const rects = range.getClientRects();
        const rect = rects[rects.length - 1];
        setPosition(utilElement, rect.left, rect.bottom);
        rectElement = null;
        return;
    }
    rectElement = target;
    utilElement.classList.remove("pdf__util--hide");
    // 手写标注没有"显示/隐藏背景"概念，操作菜单中隐藏该项；复制标注、关联功能保持可用
    const toggleItem = utilElement.querySelector('[data-type="toggle"]') as HTMLElement;
    if (toggleItem) {
        if (target.classList.contains("pdf__ink")) {
            toggleItem.classList.add("fn__none");
        } else {
            toggleItem.classList.remove("fn__none");
        }
    }
    // 手写标注取整条笔迹的外框定位，矩形标注沿用首个子块的外框
    const targetRect = target.classList.contains("pdf__ink") ? target.getBoundingClientRect() :
        target.firstElementChild.getBoundingClientRect();
    setPosition(utilElement, targetRect.left, targetRect.top + targetRect.height + 4);
};

const getTextNode = (element: HTMLElement, isFirst: boolean) => {
    const spans = element.querySelectorAll('span[role="presentation"]');
    let index = isFirst ? 0 : spans.length - 1;
    while (spans[index]) {
        if (spans[index].textContent) {
            break;
        } else {
            if (isFirst) {
                index++;
            } else {
                index--;
            }
        }
    }
    return spans[index];
};

const getHightlightCoordsByRange = (pdf: any, color: string) => {
    const range = window.getSelection().getRangeAt(0);
    const startPageElement = hasClosestByClassName(range.startContainer, "page");
    if (!startPageElement) {
        return;
    }
    const startIndex = parseInt(
        startPageElement.getAttribute("data-page-number")) - 1;

    const endPageElement = hasClosestByClassName(range.endContainer, "page");
    if (!endPageElement) {
        return;
    }
    const endIndex = parseInt(endPageElement.getAttribute("data-page-number")) - 1;
    // https://github.com/siyuan-note/siyuan/issues/5213
    const rangeContents = range.cloneContents();
    Array.from(rangeContents.children).forEach(item => {
        if (item.tagName === "BR" && item.previousElementSibling && item.nextElementSibling) {
            const previousText = item.previousElementSibling.textContent;
            const nextText = item.nextElementSibling.textContent;
            if (/^[A-Za-z]$/.test(previousText.substring(previousText.length - 2, previousText.length - 1)) &&
                /^[A-Za-z]$/.test(nextText.substring(0, 1))) {
                if (previousText.endsWith("-")) {
                    item.previousElementSibling.textContent = previousText.substring(0, previousText.length - 1);
                } else {
                    // 中文情况不能添加 https://github.com/siyuan-note/siyuan/issues/8152
                    item.insertAdjacentText("afterend", " ");
                }
            }
        }
    });
    // eslint-disable-next-line no-control-regex
    const content = Lute.EscapeHTMLStr(rangeContents.textContent.replace(/[\x00]|\n/g, ""));
    const startPage = pdf.pdfViewer.getPageView(startIndex);
    const startPageRect = startPage.canvas.getClientRects()[0];
    const startViewport = startPage.viewport;

    const cloneRange = range.cloneRange();
    if (startIndex !== endIndex) {
        range.setEndAfter(getTextNode(startPage.textLayer.div, false));
    }

    const startSelected: number[] = [];
    mergeRects(range).forEach(function (r) {
        startSelected.push(
            startViewport.convertToPdfPoint(r.left - startPageRect.x,
                r.top - startPageRect.y).concat(startViewport.convertToPdfPoint(r.right - startPageRect.x,
                r.bottom - startPageRect.y)),
        );
    });

    const endSelected: number[] = [];
    if (startIndex !== endIndex) {
        focusByRange(cloneRange);
        const endPage = pdf.pdfViewer.getPageView(endIndex);
        const endPageRect = endPage.canvas.getClientRects()[0];
        const endViewport = endPage.viewport;
        cloneRange.setStart(getTextNode(endPage.textLayer.div, true), 0);
        mergeRects(cloneRange).forEach(function (r) {
            endSelected.push(
                endViewport.convertToPdfPoint(r.left - endPageRect.x,
                    r.top - endPageRect.y).concat(endViewport.convertToPdfPoint(r.right - endPageRect.x,
                    r.bottom - endPageRect.y)),
            );
        });
    }

    const id = Lute.NewNodeID();
    const pages: {
        index: number
        positions: number[]
    }[] = [];
    const results = [];
    if (startSelected.length > 0) {
        pages.push({
            index: startIndex,
            positions: startSelected,
        });
        results.push({
            index: startIndex,
            coords: startSelected,
            id,
            color,
            content,
            type: "text",
            mode: "text",
        });
    }
    if (endSelected.length > 0) {
        pages.push({
            index: endIndex,
            positions: endSelected,
        });
        results.push({index: endIndex, coords: endSelected, id, color, content, type: "text", mode: "text"});
    }
    if (pages.length === 0) {
        return;
    }
    setConfig(pdf, id, {
        pages,
        content,
        color,
        type: "text",
        mode: "text",
    });
    return results;
};

const getHightlightCoordsByRect = (pdf: any, color: string, rectResizeElement: HTMLElement, type: string) => {
    const rect = rectResizeElement.getBoundingClientRect();

    const startPageElement = hasClosestByClassName(document.elementFromPoint(rect.left, rect.top - 1), "page");
    if (!startPageElement) {
        return;
    }
    const startIndex = parseInt(
        startPageElement.getAttribute("data-page-number")) - 1;

    const startPage = pdf.pdfViewer.getPageView(startIndex);
    const startPageRect = startPage.canvas.getClientRects()[0];
    const startViewport = startPage.viewport;

    const startSelected = startViewport.convertToPdfPoint(
        rect.left - startPageRect.x,
        rect.top - startPageRect.y).concat(startViewport.convertToPdfPoint(rect.right - startPageRect.x,
        rect.bottom - startPageRect.y));

    const pages: {
        index: number
        positions: number[]
    }[] = [
        {
            index: startPage.id - 1,
            positions: [startSelected],
        }];

    const id = Lute.NewNodeID();
    const content = `${pdf.appConfig.file.replace(location.origin, "").substr(8).replace(/-\d{14}-\w{7}.pdf$/, "")}-P${startPage.id}-${id}`;
    const result = [{
        index: startPage.id - 1,
        coords: [startSelected],
        id,
        color,
        content,
        type,
        mode: "rect",
    }];

    let endPageElement = document.elementFromPoint(rect.right, rect.bottom + 1);
    endPageElement = hasClosestByClassName(endPageElement, "page") as HTMLElement;
    if (endPageElement) {
        const endIndex = parseInt(
            endPageElement.getAttribute("data-page-number")) - 1;
        if (endIndex !== startIndex) {
            const endPage = pdf.pdfViewer.getPageView(endIndex);
            const endPageRect = endPage.canvas.getClientRects()[0];
            const endViewport = endPage.viewport;

            const endSelected = endViewport.convertToPdfPoint(
                rect.left - endPageRect.x,
                rect.top - endPageRect.y).concat(endViewport.convertToPdfPoint(rect.right - endPageRect.x,
                rect.bottom - endPageRect.y));
            pages.push({
                index: endPage.id - 1,
                positions: [endSelected],
            });
            result.push({
                index: endPage.id - 1,
                coords: [endSelected],
                id,
                color,
                content,
                type,
                mode: "rect",
            });
        }
    }

    setConfig(pdf, id, {
        pages,
        content,
        color,
        type,
        mode: "rect",
    });
    return result;
};

const mergeRects = (range: Range) => {
    const rects = range.getClientRects();
    const mergedRects: { left: number, top: number, right: number, bottom: number }[] = [];
    let lastTop: number = undefined;
    Array.from(rects).forEach(item => {
        if (item.height === 0 || item.width === 0) {
            return;
        }
        if (typeof lastTop === "undefined" || Math.abs(lastTop - item.top) > 4) {
            mergedRects.push({left: item.left, top: item.top, right: item.right, bottom: item.bottom});
            lastTop = item.top;
        } else {
            mergedRects[mergedRects.length - 1].right = item.right;
        }
    });
    return mergedRects;
};

export const getPdfInstance = (element: HTMLElement) => {
    let pdfInstance;
    getAllModels().asset.find(item => {
        if (item.pdfObject && element && item.element && typeof item.element.contains !== "undefined" && item.element.contains(element)) {
            pdfInstance = item.pdfObject;
            return true;
        }
    });
    return pdfInstance;
};

export const getHighlight = (element: HTMLElement) => {
    const pdfInstance: any = getPdfInstance(element);
    if (!pdfInstance) {
        return;
    }
    const pageIndex = parseInt(
        element.parentElement.getAttribute("data-page-number")) - 1;
    const config = getConfig(pdfInstance);
    if (!config) {
        return;
    }
    Object.keys(config).find(key => {
        const item = config[key];
        // 手写标注使用 inkPages 而非 pages，跳过避免读取 undefined 报错
        if (!item || !item.pages) {
            return false;
        }
        const page = item.pages.find((page: { index: number }) => {
            if (page.index === pageIndex) {
                return true;
            }
        });

        if (page) {
            showHighlight({
                index: pageIndex,
                coords: page.positions,
                id: key,
                color: item.color,
                content: item.content,
                type: item.type,
                mode: item.mode || "",
                ids: item.ids
            }, pdfInstance, pdfInstance.annoId === key);
        }
    });
};

const showHighlight = (selected: IPdfAnno, pdf: any, hl?: boolean) => {
    const pageIndex = selected.index;
    const page = pdf.pdfViewer.getPageView(pageIndex);
    const textLayerElement = page.textLayer.div;
    if (!textLayerElement.lastElementChild) {
        return;
    }

    const viewport = page.viewport.clone({rotation: 0}); // rotation https://github.com/siyuan-note/siyuan/issues/9831
    let rectsElement = textLayerElement.querySelector(".pdf__rects");
    if (!rectsElement) {
        textLayerElement.insertAdjacentHTML("beforeend", "<div class='pdf__rects'></div>");
        rectsElement = textLayerElement.querySelector(".pdf__rects");
    }
    let html = `<div class="pdf__rect popover__block" data-node-id="${selected.id}" data-relations="${selected.ids || ""}" data-mode="${selected.mode}">`;
    selected.coords.forEach((rect) => {
        const bounds = viewport.convertToViewportRectangle(rect);
        const width = Math.abs(bounds[0] - bounds[2]);
        if (width <= 0) {
            return;
        }
        let style = `border: 2px solid ${selected.color};background-color: ${selected.color};`;
        if (selected.type === "border") {
            style = `border: 2px solid ${selected.color};`;
        }
        html += `<div style="${style}
left:${Math.min(bounds[0], bounds[2])}px;
top:${Math.min(bounds[1], bounds[3])}px;
width:${width}px;
height: ${Math.abs(bounds[1] - bounds[3])}px"></div>`;
    });
    rectsElement.insertAdjacentHTML("beforeend", html + "</div>");
    rectsElement.lastElementChild.setAttribute("data-content", selected.content);
    if (hl) {
        hlPDFRect(rectsElement, selected.id);
    }
    return rectsElement.lastElementChild;
};

export const hlPDFRect = (element: HTMLElement, id: string) => {
    element.querySelectorAll(`.pdf__rect[data-node-id="${id}"]`).forEach(item => {
        if (item && item.firstElementChild) {
            const scrollElement = hasClosestByAttribute(item, "id", "viewerContainer");
            if (scrollElement) {
                const currentRect = item.firstElementChild.getBoundingClientRect();
                const scrollRect = scrollElement.getBoundingClientRect();
                if (currentRect.top < scrollRect.top) {
                    scrollElement.scrollTop = scrollElement.scrollTop - (scrollRect.top - currentRect.top) -
                        (scrollRect.height - currentRect.height) / 2;
                } else if (currentRect.bottom > scrollRect.bottom) {
                    scrollElement.scrollTop = scrollElement.scrollTop + (currentRect.bottom - scrollRect.bottom) +
                        (scrollRect.height - currentRect.height) / 2;
                }
            }
            item.classList.add("pdf__rect--hl");
            setTimeout(() => {
                item.classList.remove("pdf__rect--hl");
            }, 1500);
        }
    });
};

// 手写标注深链跳转定位：滚动到笔迹并添加临时强调，效果与 hlPDFRect 一致
export const hlPDFInk = (element: Element, id: string) => {
    element.querySelectorAll(`.pdf__ink[data-node-id="${id}"]`).forEach((item: SVGElement) => {
        if (!item) {
            return;
        }
        // 重复触发时先移除再添加，保证动画重新播放
        item.classList.remove("pdf__ink--hl");
        const scrollElement = hasClosestByAttribute(item, "id", "viewerContainer");
        if (scrollElement) {
            const currentRect = item.getBoundingClientRect();
            const scrollRect = scrollElement.getBoundingClientRect();
            if (currentRect.top < scrollRect.top) {
                scrollElement.scrollTop = scrollElement.scrollTop - (scrollRect.top - currentRect.top) -
                    (scrollRect.height - currentRect.height) / 2;
            } else if (currentRect.bottom > scrollRect.bottom) {
                scrollElement.scrollTop = scrollElement.scrollTop + (currentRect.bottom - scrollRect.bottom) +
                    (scrollRect.height - currentRect.height) / 2;
            }
        }
        item.classList.add("pdf__ink--hl");
        setTimeout(() => {
            item.classList.remove("pdf__ink--hl");
        }, 1500);
    });
};

// 手写标注的基准线宽（CSS 像素），实际线宽会按书写压感缩放
const INK_BASE_WIDTH = 2;

export const initInk = (element: HTMLElement, pdf: any) => {
    const pdfConfig = pdf.appConfig;
    const inkAnnoElement = pdfConfig.toolbar.inkAnno;
    if (!inkAnnoElement) {
        return;
    }
    const inkEraseElement = pdfConfig.toolbar.inkErase;
    const inkUndoElement = pdfConfig.toolbar.inkUndo;
    const inkRedoElement = pdfConfig.toolbar.inkRedo;

    // 书写、擦除、框选三种模式互斥，切换时清理其余模式的状态
    const switchMode = (mode: "ink" | "erase" | "") => {
        const rectAnnoElement = pdfConfig.toolbar.rectAnno;
        if (rectAnnoElement && rectAnnoElement.classList.contains("toggled")) {
            rectAnnoElement.classList.remove("toggled");
            pdfConfig.mainContainer.classList.remove("rect-to-annotation");
        }
        inkAnnoElement.classList.toggle("toggled", mode === "ink");
        pdfConfig.mainContainer.classList.toggle("ink-to-annotation", mode === "ink");
        if (inkEraseElement) {
            inkEraseElement.classList.toggle("toggled", mode === "erase");
        }
        pdfConfig.mainContainer.classList.toggle("ink-erase-annotation", mode === "erase");
        if (mode) {
            pdf.pdfCursorTools.switchTool(0);
            if (getSelection().rangeCount > 0) {
                getSelection().getRangeAt(0).collapse(true);
            }
            hideToolbar(element);
        }
    };

    // 右键取消：退出当前书写/擦除模式，并丢弃未完成的操作
    const cancelInk = () => {
        if (inkAnnoElement.classList.contains("toggled")) {
            switchMode("");
            pdf.pdfCursorTools.switchTool(0);
        } else if (inkEraseElement && inkEraseElement.classList.contains("toggled")) {
            switchMode("");
            pdf.pdfCursorTools.switchTool(0);
        }
    };

    inkAnnoElement.addEventListener("click", () => {
        switchMode(inkAnnoElement.classList.contains("toggled") ? "" : "ink");
    });
    if (inkEraseElement) {
        inkEraseElement.addEventListener("click", () => {
            switchMode(inkEraseElement.classList.contains("toggled") ? "" : "erase");
        });
    }
    if (inkUndoElement) {
        inkUndoElement.addEventListener("click", () => {
            undoInk(pdf, element);
        });
    }
    if (inkRedoElement) {
        inkRedoElement.addEventListener("click", () => {
            redoInk(pdf, element);
        });
    }
    // 右键取消当前模式；阻止默认右键菜单，避免与编辑器菜单冲突
    pdfConfig.mainContainer.addEventListener("contextmenu", (event: MouseEvent) => {
        if (!isInkToolActive(pdf)) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        cancelInk();
    });
    // 指针事件同样拦截右键，触控板/触屏的右键手势也视为取消
    pdfConfig.mainContainer.addEventListener("pointerdown", (event: PointerEvent) => {
        if (event.button === 2 && isInkToolActive(pdf)) {
            event.preventDefault();
            event.stopPropagation();
            cancelInk();
        }
    });

    // 快捷键：Ctrl/⌘+Z 撤销、Ctrl/⌘+Y（或 Ctrl+Shift+Z）重做
    const onInkKeyDown = (event: KeyboardEvent) => {
        if (event.ctrlKey || event.metaKey) {
            const key = event.key.toLowerCase();
            const tagName = (event.target as HTMLElement)?.tagName;
            // 输入框内不接管，避免影响文本编辑
            if (tagName === "INPUT" || tagName === "TEXTAREA") {
                return;
            }
            if (key === "z" && !event.shiftKey) {
                event.preventDefault();
                undoInk(pdf);
            } else if (key === "y" || (key === "z" && event.shiftKey)) {
                event.preventDefault();
                redoInk(pdf);
            }
        }
    };
    window.addEventListener("keydown", onInkKeyDown);
    pdf.appConfig.onInkKeyDownCleanup = () => window.removeEventListener("keydown", onInkKeyDown);

    // 橡皮擦：按下并拖动，经过的笔画整条移除
    pdfConfig.mainContainer.addEventListener("pointerdown", (event: PointerEvent) => {
        if (!inkEraseElement || !inkEraseElement.classList.contains("toggled") || event.button !== 0) {
            return;
        }
        event.preventDefault();
        const pointerId = event.pointerId;
        pushInkUndo(pdf);
        let erased = eraseInkAt(pdf, event.clientX, event.clientY);
        const moveHandler = (moveEvent: PointerEvent) => {
            if (moveEvent.pointerId !== pointerId) {
                return;
            }
            erased = eraseInkAt(pdf, moveEvent.clientX, moveEvent.clientY) || erased;
        };
        const upHandler = (upEvent: PointerEvent) => {
            if (upEvent.pointerId !== pointerId) {
                return;
            }
            document.removeEventListener("pointermove", moveHandler);
            document.removeEventListener("pointerup", upHandler);
            document.removeEventListener("pointercancel", upHandler);
            if (erased) {
                saveConfig(pdf);
            } else {
                // 未擦到任何笔画时丢弃这一步，避免撤销栈里出现空操作
                pdf.inkUndoStack.pop();
            }
        };
        document.addEventListener("pointermove", moveHandler);
        document.addEventListener("pointerup", upHandler);
        document.addEventListener("pointercancel", upHandler);
    });

    pdfConfig.mainContainer.addEventListener("pointerdown", (event: PointerEvent) => {
        if (!inkAnnoElement.classList.contains("toggled")) {
            return;
        }
        if (event.button !== 0) {
            return;
        }
        // 一次只跟踪一个指针：手写笔书写时的手掌接触、多指触摸都会被忽略
        if (pdf.inkDrawingPointerId !== undefined) {
            return;
        }
        // 点击已有手写标注时交给选中逻辑处理，不开启新的笔画
        if (hasClosestByClassName(event.target as HTMLElement, "pdf__ink")) {
            return;
        }
        const pageElement = hasClosestByClassName(event.target as HTMLElement, "page");
        if (!pageElement) {
            return;
        }
        event.preventDefault();
        // 记录正在书写的指针，move/up 只响应这一个，避免多指/手掌干扰
        pdf.inkDrawingPointerId = event.pointerId;
        const color = window.siyuan.storage[Constants.LOCAL_PDFTHEME].annoColor || "var(--b3-pdf-background1)";
        let drawing = true;
        // 跨页书写时按页拆分：每页保存自己的笔画段，并各自拥有一个绘制分组
        const pageStrokes = new Map<number, number[][][]>();
        const pageGroups = new Map<number, SVGGElement>();
        let currentPageIndex = -1;
        let currentStroke: number[][] = null;
        let lastPoint: { x: number, y: number, pressure: number } = null;
        // 页面矩形随滚动变化，绘制过程中缓存并在滚动时失效
        const pageRects = new Map<number, DOMRect>();
        let visibleViews = pdf.pdfViewer._getVisiblePages().views;
        const resetCache = () => {
            pageRects.clear();
            visibleViews = pdf.pdfViewer._getVisiblePages().views;
        };
        pdfConfig.mainContainer.addEventListener("scroll", resetCache, true);

        const getPageRect = (pageView: any, pageIndex: number) => {
            if (!pageRects.has(pageIndex)) {
                pageRects.set(pageIndex, pageView.canvas.getBoundingClientRect());
            }
            return pageRects.get(pageIndex);
        };

        const drawSegment = (pageView: any, pageIndex: number, from: number[], to: number[], pressure: number) => {
            // 渲染坐标使用去除旋转后的视口，与高亮标注保持一致
            const renderViewport = pageView.viewport.clone({rotation: 0});
            const p1 = renderViewport.convertToViewportPoint(from[0], from[1]);
            const p2 = renderViewport.convertToViewportPoint(to[0], to[1]);
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", `M${p1[0]} ${p1[1]} L${p2[0]} ${p2[1]}`);
            path.setAttribute("stroke", color);
            path.setAttribute("stroke-width", (INK_BASE_WIDTH * (0.5 + pressure)).toString());
            path.setAttribute("fill", "none");
            path.setAttribute("stroke-linecap", "round");
            path.setAttribute("stroke-linejoin", "round");
            pageGroups.get(pageIndex).appendChild(path);
        };

        const addPoint = (clientX: number, clientY: number, pressure: number) => {
            const pageIndex = locatePageAt(pdf, clientX, clientY, visibleViews);
            if (pageIndex < 0) {
                return;
            }
            const pageView = pdf.pdfViewer.getPageView(pageIndex);
            if (!pageView || !pageView.canvas || !pageView.textLayer || !pageView.textLayer.div) {
                return;
            }
            const canvasRect = getPageRect(pageView, pageIndex);
            // 捕获坐标使用真实（含旋转）视口
            const toPdfPoint = (x: number, y: number) =>
                pageView.viewport.convertToPdfPoint(x - canvasRect.x, y - canvasRect.y);
            if (pageIndex !== currentPageIndex) {
                currentPageIndex = pageIndex;
                currentStroke = [];
                if (!pageStrokes.has(pageIndex)) {
                    pageStrokes.set(pageIndex, []);
                }
                pageStrokes.get(pageIndex).push(currentStroke);
                if (!pageGroups.has(pageIndex)) {
                    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
                    g.setAttribute("class", "pdf__ink pdf__ink--draft");
                    ensureInkSvg(pageView.textLayer.div).appendChild(g);
                    pageGroups.set(pageIndex, g);
                }
                if (lastPoint) {
                    // 换页时把上一个点按新页坐标接上，越出页面的部分会被覆盖层裁掉，笔迹看起来是连续的
                    const prevPdfPt = toPdfPoint(lastPoint.x, lastPoint.y);
                    currentStroke.push([prevPdfPt[0], prevPdfPt[1], lastPoint.pressure]);
                }
            }
            const pdfPt = toPdfPoint(clientX, clientY);
            const previous = currentStroke[currentStroke.length - 1];
            currentStroke.push([pdfPt[0], pdfPt[1], pressure]);
            if (previous) {
                drawSegment(pageView, pageIndex, previous, [pdfPt[0], pdfPt[1]], pressure);
            }
            lastPoint = {x: clientX, y: clientY, pressure};
        };

        addPoint(event.clientX, event.clientY, event.pressure || 0.5);

        const moveHandler = (moveEvent: PointerEvent) => {
            if (!drawing) {
                return;
            }
            addPoint(moveEvent.clientX, moveEvent.clientY, moveEvent.pressure || 0.5);
        };
        const upHandler = () => {
            drawing = false;
            pdf.inkDrawingPointerId = undefined;
            document.removeEventListener("pointermove", moveHandler);
            document.removeEventListener("pointerup", upHandler);
            document.removeEventListener("pointercancel", upHandler);
            pdfConfig.mainContainer.removeEventListener("scroll", resetCache, true);
            const inkPages: { index: number, strokes: number[][][] }[] = [];
            pageStrokes.forEach((strokes, pageIndex) => {
                const validStrokes = strokes.filter(item => item.length >= 2);
                if (validStrokes.length > 0) {
                    inkPages.push({index: pageIndex, strokes: validStrokes});
                }
            });
            inkPages.sort((a, b) => a.index - b.index);
            if (inkPages.length === 0) {
                pageGroups.forEach(item => item.remove());
                return;
            }
            // 未产生有效笔画的页面（如仅擦过一两个点）不保留空分组
            pageGroups.forEach((item, pageIndex) => {
                if (!inkPages.find(inkPage => inkPage.index === pageIndex)) {
                    item.remove();
                    pageGroups.delete(pageIndex);
                }
            });
            const id = Lute.NewNodeID();
            const fileName = pdf.appConfig.file.replace(location.origin, "").substr(8).replace(/-\d{14}-\w{7}.pdf$/, "");
            const content = `${fileName}-P${inkPages[0].index + 1}-${id}`;
            // 提交前保存撤销快照，便于撤销刚完成的笔迹
            pushInkUndo(pdf);
            setConfig(pdf, id, {
                inkPages,
                content,
                color,
                type: "ink",
                mode: "ink",
            });
            pageGroups.forEach(item => {
                item.setAttribute("data-node-id", id);
                item.setAttribute("data-mode", "ink");
                item.setAttribute("data-content", content);
                item.setAttribute("data-relations", "");
                item.classList.remove("pdf__ink--draft");
                item.classList.add("popover__block");
            });
        };
        document.addEventListener("pointermove", moveHandler);
        document.addEventListener("pointerup", upHandler);
        document.addEventListener("pointercancel", upHandler);
    });
};

export const getInk = (element: HTMLElement) => {
    const pdfInstance: any = getPdfInstance(element);
    if (!pdfInstance) {
        return;
    }
    const pageIndex = parseInt(element.parentElement.getAttribute("data-page-number")) - 1;
    renderInkPage(pdfInstance, pageIndex);
};

const ensureInkSvg = (textLayerElement: HTMLElement) => {
    let svg = textLayerElement.querySelector(".pdf__inks") as SVGSVGElement;
    if (!svg) {
        svg = document.createElementNS("http://www.w3.org/2000/svg", "svg") as SVGSVGElement;
        svg.setAttribute("class", "pdf__inks");
        textLayerElement.appendChild(svg);
    }
    return svg;
};

const renderInkPage = (pdf: any, pageIndex: number) => {
    const pageView = pdf.pdfViewer.getPageView(pageIndex);
    if (!pageView || !pageView.textLayer || !pageView.textLayer.div) {
        return;
    }
    const textLayerElement = pageView.textLayer.div;
    const svg = ensureInkSvg(textLayerElement);
    while (svg.firstChild) {
        svg.removeChild(svg.firstChild);
    }
    const config = getConfig(pdf);
    if (!config) {
        return;
    }
    Object.keys(config).forEach(key => {
        const item = config[key];
        if (!item || item.type !== "ink" || !item.inkPages) {
            return;
        }
        const page = item.inkPages.find((p: { index: number }) => p.index === pageIndex);
        if (!page) {
            return;
        }
        showInk({
            index: pageIndex,
            inkPages: item.inkPages,
            id: key,
            color: item.color,
            content: item.content,
            type: item.type,
            mode: item.mode,
            ids: item.ids,
        }, pdf);
    });
};

const showInk = (selected: IPdfAnno, pdf: any) => {
    const pageIndex = selected.index;
    const pageView = pdf.pdfViewer.getPageView(pageIndex);
    if (!pageView || !pageView.textLayer || !pageView.textLayer.div) {
        return;
    }
    const textLayerElement = pageView.textLayer.div;
    const svg = ensureInkSvg(textLayerElement);
    const viewport = pageView.viewport.clone({rotation: 0});
    const inkPages = selected.inkPages || [];
    inkPages.filter((p: any) => p.index === pageIndex).forEach((page: any) => {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "pdf__ink popover__block");
        g.setAttribute("data-node-id", selected.id);
        g.setAttribute("data-relations", selected.ids ? selected.ids.join(",") : "");
        g.setAttribute("data-mode", "ink");
        g.setAttribute("data-content", selected.content);
        page.strokes.forEach((stroke: number[][]) => {
            for (let i = 0; i < stroke.length - 1; i++) {
                const p1 = viewport.convertToViewportPoint(stroke[i][0], stroke[i][1]);
                const p2 = viewport.convertToViewportPoint(stroke[i + 1][0], stroke[i + 1][1]);
                const pressure = stroke[i][2] || 0.5;
                const width = INK_BASE_WIDTH * (0.5 + pressure);
                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("d", `M${p1[0]} ${p1[1]} L${p2[0]} ${p2[1]}`);
                path.setAttribute("stroke", selected.color);
                path.setAttribute("stroke-width", width.toString());
                path.setAttribute("fill", "none");
                path.setAttribute("stroke-linecap", "round");
                path.setAttribute("stroke-linejoin", "round");
                g.appendChild(path);
            }
            // 透明加宽命中区，便于点击选中
            const hit = document.createElementNS("http://www.w3.org/2000/svg", "path");
            const d = stroke.map((pt: number[], idx: number) => {
                const vp = viewport.convertToViewportPoint(pt[0], pt[1]);
                return (idx === 0 ? "M" : "L") + vp[0] + " " + vp[1];
            }).join(" ");
            hit.setAttribute("d", d);
            hit.setAttribute("stroke", "transparent");
            hit.setAttribute("stroke-width", "12");
            hit.setAttribute("fill", "none");
            g.appendChild(hit);
        });
        svg.appendChild(g);
        // 深链跳转到该手写标注时，渲染完成后滚动定位并强调；跨页笔迹只在起始页触发，避免来回跳动
        const firstPageIndex = Math.min(...inkPages.map((item: any) => item.index));
        if (pdf.annoId === selected.id && pageIndex === firstPageIndex) {
            hlPDFInk(svg, selected.id);
        }
    });
};

// 将当前标注配置整体持久化，供撤销/擦除后回写
const saveConfig = (pdf: any) => {
    fetchPost("/api/asset/setFileAnnotation", {
        path: pdf.appConfig.file.replace(location.origin, "").substr(1) + ".sya",
        data: JSON.stringify(pdf.appConfig.config || {}),
    });
};

// 保证配置已就绪并返回非空对象：若尚未加载完成则先用空对象兜底，
// 避免在配置返回前写入标注时因 undefined 赋值而崩溃
const ensureConfig = (pdf: any) => {
    if (!pdf.appConfig.config) {
        getConfig(pdf);
        if (!pdf.appConfig.config) {
            pdf.appConfig.config = {};
        }
    }
    return pdf.appConfig.config;
};

// 配置快照：深拷贝，避免后续改动污染已入栈的状态
const configSnapshot = (pdf: any) => JSON.parse(JSON.stringify(pdf.appConfig.config || {}));

// 将当前配置快照压入指定栈，超出上限（50 步）时丢弃最早的快照
const pushInkStack = (stack: any[], pdf: any) => {
    if (!stack) {
        stack = [];
    }
    stack.push(configSnapshot(pdf));
    if (stack.length > 50) {
        stack.shift();
    }
    return stack;
};

// 手写标注撤销栈：保存当前配置快照（不清空重做分支）
const pushInkUndoRaw = (pdf: any) => {
    ensureConfig(pdf);
    pdf.inkUndoStack = pushInkStack(pdf.inkUndoStack, pdf);
};

// 产生一次新的书写/擦除操作时压入撤销快照，并使旧的重做分支失效
const pushInkUndo = (pdf: any) => {
    pushInkUndoRaw(pdf);
    // 产生新操作后旧的重做分支失效
    pdf.inkRedoStack = [];
};

// 手写标注重做栈：保存当前配置快照（不含清空逻辑，由调用方控制）
const pushInkRedo = (pdf: any) => {
    pdf.inkRedoStack = pushInkStack(pdf.inkRedoStack, pdf);
};

// 应用一份配置快照并持久化、重绘全部页面
const applyInkConfig = (pdf: any, snapshot: any) => {
    pdf.appConfig.config = snapshot;
    saveConfig(pdf);
    renderAnnotationsAfterLoad(pdf);
};

// 撤销上一步手写操作：当前状态入重做栈，恢复撤销栈顶快照
const undoInk = (pdf: any, element?: HTMLElement) => {
    if (!pdf.inkUndoStack || pdf.inkUndoStack.length === 0) {
        showMessage(window.siyuan.languages.inkNothingToUndo);
        return;
    }
    ensureConfig(pdf);
    pushInkRedo(pdf);
    applyInkConfig(pdf, pdf.inkUndoStack.pop());
    if (element) {
        hideToolbar(element);
    }
};

// 重做上一步手写操作：当前状态入撤销栈，恢复重做栈顶快照
const redoInk = (pdf: any, element?: HTMLElement) => {
    if (!pdf.inkRedoStack || pdf.inkRedoStack.length === 0) {
        showMessage(window.siyuan.languages.inkNothingToRedo);
        return;
    }
    ensureConfig(pdf);
    // 先取重做快照再入撤销栈；入撤销栈须用不清空重做栈的 Raw 版本，
    // 否则每次重做都会清空剩余重做分支，导致重做只能执行一次
    const snapshot = pdf.inkRedoStack.pop();
    pushInkUndoRaw(pdf);
    applyInkConfig(pdf, snapshot);
    if (element) {
        hideToolbar(element);
    }
};

// 当前是否处于手写或擦除模式
const isInkToolActive = (pdf: any) => {
    const toolbar = pdf.appConfig.toolbar;
    return (toolbar.inkAnno && toolbar.inkAnno.classList.contains("toggled")) ||
        (toolbar.inkErase && toolbar.inkErase.classList.contains("toggled"));
};

// 点到线段的最短距离，用于橡皮擦命中测试
const pointToSegmentDistance = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + t * dx;
    const cy = y1 + t * dy;
    return Math.hypot(px - cx, py - cy);
};

// 判断客户端坐标落在哪一页，页面间隙返回 -1
// 判断客户端坐标落在哪一页，位于页面间空隙时返回 -1；
// views 可省略（默认重新取可见页），传入缓存的可见页以便在绘制期间复用滚动缓存
const locatePageAt = (pdf: any, clientX: number, clientY: number, views?: any[]) => {
    if (!views) {
        views = pdf.pdfViewer._getVisiblePages().views;
    }
    let index = -1;
    views.forEach((visibleView: any) => {
        const rect = visibleView.view.div.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right &&
            clientY >= rect.top && clientY <= rect.bottom) {
            index = visibleView.id - 1;
        }
    });
    return index;
};

// 橡皮擦：移除落点附近整条笔画，命中则同步更新配置并重绘所在页，返回是否擦除到内容
const eraseInkAt = (pdf: any, clientX: number, clientY: number) => {
    const pageIndex = locatePageAt(pdf, clientX, clientY);
    if (pageIndex < 0) {
        return false;
    }
    const pageView = pdf.pdfViewer.getPageView(pageIndex);
    if (!pageView || !pageView.textLayer || !pageView.textLayer.div) {
        return false;
    }
    const canvasRect = pageView.canvas.getBoundingClientRect();
    const localX = clientX - canvasRect.left;
    const localY = clientY - canvasRect.top;
    const viewport = pageView.viewport.clone({rotation: 0});
    const config = getConfig(pdf);
    if (!config) {
        return false;
    }
    const eraseThreshold = 8;
    let changed = false;
    // 跨页标注命中后整条移除，需要把所有涉及页面一并重绘，避免其他页残留
    const affectedPages = new Set<number>();
    Object.keys(config).forEach(key => {
        const item = config[key];
        if (!item) {
            return;
        }
        if (item.type === "ink" && item.inkPages) {
            // 手写笔迹：命中任一线段即移除整条跨页标注
            const inkPage = item.inkPages.find((p: any) => p.index === pageIndex);
            if (!inkPage) {
                return;
            }
            const hitStroke = inkPage.strokes.find((stroke: number[][]) => {
                if (stroke.length === 1) {
                    const p = viewport.convertToViewportPoint(stroke[0][0], stroke[0][1]);
                    return Math.hypot(localX - p[0], localY - p[1]) <= eraseThreshold;
                }
                for (let i = 0; i < stroke.length - 1; i++) {
                    const p1 = viewport.convertToViewportPoint(stroke[i][0], stroke[i][1]);
                    const p2 = viewport.convertToViewportPoint(stroke[i + 1][0], stroke[i + 1][1]);
                    if (pointToSegmentDistance(localX, localY, p1[0], p1[1], p2[0], p2[1]) <= eraseThreshold) {
                        return true;
                    }
                }
                return false;
            });
            if (hitStroke) {
                changed = true;
                item.inkPages.forEach((p: any) => affectedPages.add(p.index));
                delete config[key];
            }
        } else if (item.pages) {
            // 矩形标注：只有点击落在框线上才擦除，落在矩形内部不生效
            const page = item.pages.find((p: any) => p.index === pageIndex);
            if (!page) {
                return;
            }
            const hitBorder = page.positions.find((rect: number[]) => {
                const bounds = viewport.convertToViewportRectangle(rect);
                // 四个角点的视口坐标
                const x1 = bounds[0];
                const y1 = bounds[1];
                const x2 = bounds[2];
                const y2 = bounds[3];
                // 矩形的四条边线段，点击到任一边的距离在阈值内即视为擦中框线
                const edges: number[][] = [
                    [x1, y1, x2, y1], // 上边
                    [x1, y2, x2, y2], // 下边
                    [x1, y1, x1, y2], // 左边
                    [x2, y1, x2, y2], // 右边
                ];
                return edges.some((edge) =>
                    pointToSegmentDistance(localX, localY, edge[0], edge[1], edge[2], edge[3]) <= eraseThreshold);
            });
            if (hitBorder) {
                changed = true;
                item.pages.forEach((p: any) => affectedPages.add(p.index));
                delete config[key];
            }
        }
    });
    affectedPages.add(pageIndex);
    if (changed) {
        // 同步刷新手写层与矩形高亮层，保证两类标注擦除后都能即时更新
        affectedPages.forEach(p => refreshAnnoOnPage(pdf, p));
    }
    return changed;
};

const copyAnno = (idPath: string, fileName: string, pdf: any) => {
    const mode = rectElement.getAttribute("data-mode");
    const content = rectElement.getAttribute("data-content");
    setTimeout(() => {
        if (mode === "rect" ||
            (mode === "" && rectElement.childElementCount === 1 && content.startsWith(fileName)) // 兼容历史，以前没有 mode
        ) {
            getRectImgData(pdf).then((imageData) => {
                fetch(imageData.url).then((response) => {
                    return response.blob();
                }).then((blob) => {
                    let msg = "";
                    if (Constants.SIZE_UPLOAD_TIP_SIZE <= blob.size) {
                        msg = window.siyuan.languages.uploadFileTooLarge.replace("${x}", content + ".png").replace("${y}", filesize(blob.size, {standard: "iec"}));
                    }
                    confirmDialog(msg ? window.siyuan.languages.upload : "", msg, () => {
                        const formData = new FormData();
                        const imageName = content.substring(0, content.length - 22) + (imageData.rotation ? `${imageData.rotation}-` : "") + content.substring(content.length - 22) + ".png";
                        formData.append("file[]", blob, imageName);
                        formData.append("skipIfDuplicated", "true");
                        fetchPost(Constants.UPLOAD_ADDRESS, formData, (response) => {
                            writeText(`<<${idPath} "${content}">>
![](${response.data.succMap[imageName]})`);
                        });
                    });
                });
            });
        } else {
            writeText(`<<${idPath} "${content}">>`);
        }
    }, Constants.TIMEOUT_DBLCLICK);
};

async function getRectImgData(pdfObj: any) {
    const pageElement = hasClosestByClassName(rectElement, "page");
    if (!pageElement) {
        return;
    }

    const pageNumber = parseInt(pageElement.getAttribute("data-page-number"));
    const pageView = pdfObj.pdfViewer.getPageView(pageNumber - 1);
    if (!pageView) {
        return;
    }

    // PDF 截图时的缩放倍数，用于提高截图清晰度
    const CAPTURE_SCALE_RATIO = 1.5;

    const pdfPage = await pdfObj.pdfDocument.getPage(pageNumber);
    const captureViewport = pdfPage.getViewport({
        scale: pdfObj.pdfViewer.currentScale * window.pdfjsLib.PixelsPerInch.PDF_TO_CSS_UNITS * CAPTURE_SCALE_RATIO,
        rotation: 0
    });
    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = Math.floor(captureViewport.width);
    captureCanvas.height = Math.floor(captureViewport.height);

    const captureCtx = captureCanvas.getContext("2d");
    await pdfPage.render({
        canvasContext: captureCtx,
        viewport: captureViewport
    }).promise;

    const rectStyle = (rectElement.firstElementChild as HTMLElement).style;
    const captureImageData = captureCtx.getImageData(
        CAPTURE_SCALE_RATIO * parseFloat(rectStyle.left),
        CAPTURE_SCALE_RATIO * parseFloat(rectStyle.top),
        CAPTURE_SCALE_RATIO * parseFloat(rectStyle.width),
        CAPTURE_SCALE_RATIO * parseFloat(rectStyle.height)
    );

    const resultCanvas = document.createElement("canvas");
    resultCanvas.width = captureImageData.width;
    resultCanvas.height = captureImageData.height;
    // 页面实际旋转角度 = 用户旋转 + PDF 本身旋转
    const totalRotation = (pageView.rotation + pageView.pdfPageRotate) % 360;
    const resultCtx = resultCanvas.getContext("2d");
    if (totalRotation === 0) {
        resultCtx.putImageData(captureImageData, 0, 0);
    } else {
        // 交换宽高
        if (totalRotation === 90 || totalRotation === 270) {
            [resultCanvas.width, resultCanvas.height] = [resultCanvas.height, resultCanvas.width];
        }
        resultCtx.translate(resultCanvas.width / 2, resultCanvas.height / 2);
        resultCtx.rotate((totalRotation * Math.PI) / 180);
        // 在旋转后的画布坐标系上绘制图片
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = captureImageData.width;
        tempCanvas.height = captureImageData.height;
        const tempCtx = tempCanvas.getContext("2d");
        tempCtx.putImageData(captureImageData, 0, 0);
        resultCtx.drawImage(tempCanvas, -tempCanvas.width / 2, -tempCanvas.height / 2);
    }

    return {url: resultCanvas.toDataURL(), rotation: totalRotation};
}

const setConfig = (pdf: any, id: string, data: IPdfAnno) => {
    const config = ensureConfig(pdf);
    config[id] = data;
    fetchPost("/api/asset/setFileAnnotation", {
        path: pdf.appConfig.file.replace(location.origin, "").substr(1) + ".sya",
        data: JSON.stringify(config),
    });
};

const getConfig = (pdf: any) => {
    if (pdf.appConfig.config) {
        return pdf.appConfig.config;
    }
    const urlPath = pdf.appConfig.file.replace(location.origin, "").substr(1) + ".sya";
    fetchPost("/api/asset/getFileAnnotation", {
        path: urlPath,
    }, (response) => {
        let config = {};
        if (response.code !== 1) {
            config = JSON.parse(response.data.data);
        }
        pdf.appConfig.config = config;
        // 配置为异步加载，文本层可能在配置返回前就已渲染完成，
        // 此时标注不会绘制。配置就绪后对当前已渲染的页面重新绘制标注，避免重新打开 PDF 后标注缺失
        renderAnnotationsAfterLoad(pdf);
    });
    return pdf.appConfig.config;
};

// 刷新单页的矩形/文本标注与手写标注，擦除与配置加载后复用同一逻辑
const refreshAnnoOnPage = (pdf: any, pageIndex: number) => {
    renderInkPage(pdf, pageIndex);
    const pageView = pdf.pdfViewer.getPageView(pageIndex);
    if (!pageView?.textLayer?.div) {
        return;
    }
    pageView.textLayer.div.querySelector(".pdf__rects")?.remove();
    getHighlight(pageView.textLayer.div);
};

// 配置加载完成后，对已渲染完成的页面重绘矩形/文本标注与手写标注
const renderAnnotationsAfterLoad = (pdf: any) => {
    const pages = pdf.pdfViewer?._pages;
    if (!Array.isArray(pages) || pages.length === 0) {
        return;
    }
    pages.forEach((pageView: any) => {
        if (!pageView || !pageView.textLayer || !pageView.textLayer.div) {
            return;
        }
        refreshAnnoOnPage(pdf, pageView.id - 1);
    });
};
