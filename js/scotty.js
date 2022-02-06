
/* Scotty - 2022 https://github.com/marcowi/scotty */

const scotty = {

    currentPDF: null,
    pdfjsLib: null,
    occ: null,
    occp: null,
    canvas: null,
    ctx: null,
    usedColors: null,
    colorReplacements: {},
    pos: null,
    mouseDownHandle: null,
    mouseMoveHandle: null,
    mouseUpHandle: null,
    currentPage: 1,

    init: function () {
        this.pdfjsLib = window['pdfjs-dist/build/pdf'];
        this.pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/pdf.worker.js';

        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');

        this.mouseDownHandle = this.mouseDownHandler.bind(this);
        this.canvas.addEventListener('mousedown', this.mouseDownHandle, true);
        this.pos = {top: 0, left: 0, x: 0, y: 0};

        let that = this;

        document.getElementById("slider-ratation").addEventListener('input', function () {
            document.getElementById("input-rotation").value = this.value;
            that.canvas.style.transform = "rotate(" + this.value + "deg)";
        });

        document.getElementById("input-file").addEventListener('change', function(event) {

            let file = event.target.files[0];
            let fileReader = new FileReader();

            fileReader.onload = function() {
                let typedarray = new Uint8Array(this.result);
                that.load(typedarray);
            };

            fileReader.readAsArrayBuffer(file);
        });

        document.getElementById("slider-pagenum").addEventListener('input', function () {
            let pageNum = parseInt(this.value);
            document.getElementById("input-pagenum").value = pageNum;
            that.currentPage = pageNum;
        });

    },

    load: function (file) {

        const loadingTask = pdfjsLib.getDocument(file);
        let that = this;

        that.currentPage = 1;

        that.pos = {top: 0, left: 0, x: 0, y: 0};


        loadingTask.promise.then(function(pdf) {
            that.currentPDF = pdf;
            that.occp = that.currentPDF.getOptionalContentConfig();
            that.clearLayerControls();
            that.occp.then(function (occ) {
                that.occ = occ;
                that.occ._groups.forEach(function (value, key) {
                    that.addLayerControl({id: key, name: value.name, visible: value.visible});
                })
            });

            let pageCount = that.currentPDF.numPages;
            if (pageCount > 1) {
                document.querySelector(".control-group.pages").style.display = "block";
                let pageSlider = document.getElementById("slider-pagenum");
                pageSlider.setAttribute("max", pageCount);
            } else {
                document.querySelector(".control-group.pages").style.display = "none";
                let pageSlider = document.getElementById("slider-pagenum");
                pageSlider.setAttribute("max", "1");
                document.getElementById("input-pagenum").value = 1;
            }

            that.render();

        }, function (reason) {
            console.error(reason);
        });
    },

    render: function () {

        let that = this;

        that.currentPDF.getPage(that.currentPage).then(function(page) {

            let scale = document.getElementById("input-scale").value;
            let rotation = document.getElementById("input-rotation").value;
            let viewport = page.getViewport({scale: scale});
            document.getElementById("slider-ratation").value = rotation;
            that.canvas.style.transform = "rotate(" + rotation + "deg)";
            that.canvas.height = viewport.height;
            that.canvas.width = viewport.width;

            let renderContext = {
                canvasContext: that.ctx,
                background: 'rgba(0,0,0,0)',
                optionalContentConfigPromise: Promise.resolve(that.occp),
                viewport: viewport,
                overrideColor: that.colorReplacements
            };
            let renderTask = page.render(renderContext);

            renderTask.promise.then(function () {

                that.usedColors = Array.from(renderTask._internalRenderTask.gfx.usedColors).sort();

                if (that.occ._groups.size === 0) {
                    document.querySelector(".control-wrapper.layers").style.display = "none";
                    document.querySelector(".control-wrapper.colors").style.display = "block";

                    if (document.getElementById("colors").innerHTML === "") {
                        that.usedColors.forEach(function (color) {
                            that.addColorControl({hex: color,  visible: true});
                        })
                    }
                } else {
                    document.querySelector(".control-wrapper.colors").style.display = "none";
                    document.querySelector(".control-wrapper.layers").style.display = "block";
                }

            });
        });
    },

    refresh: function () {
        let that = this;
        this.usedColors.forEach(function (color) {
            if (document.getElementById("input-color-override-checkbox").checked) {
                if (!(that.colorReplacements.hasOwnProperty(color) && that.colorReplacements[color].length > 7)) {
                    that.colorReplacements[color] = document.getElementById("input-color-override").value;
                }
            } else {
                if (that.colorReplacements.hasOwnProperty(color) && that.colorReplacements[color].length === 7) {
                    delete that.colorReplacements[color];
                }
            }
        })

        that.render();
    },

    toggleControls: function () {
        let controls = document.getElementById("controls");
        let toggleBar = document.getElementById("toggle-controls");
        if (controls.style.display === "none") {
            controls.style.display = "block";
            toggleBar.innerText = "<<";
        } else {
            controls.style.display = "none";
            toggleBar.innerText = ">>";
        }
    },

    toggleBackground: function () {
        let bg = this.canvas.style.backgroundColor === 'black' ? 'white' : 'black';
        this.canvas.style.backgroundColor = bg;
        document.body.style.backgroundColor = bg;
    },

    addLayerControl: function (layer) {
        let layerControl = document.createElement("div");
        layerControl.innerHTML = "<div class='layer-visibility'>&#9673;</div><div class='layer-text'>" + layer.name + " (" + layer.id + ")" + "</div>";
        layerControl.classList.add("visible");
        layerControl.addEventListener("click", function () {
            layer.visible = !layer.visible;
            if (layer.visible) {
                layerControl.classList.add("visible");
            } else {
                layerControl.classList.remove("visible");
            }
            this.occ.setVisibility(layer.id, layer.visible);
            this.render();
        }.bind(this));
        let layerControlList = document.getElementById("layers");
        layerControlList.append(layerControl);
    },

    clearLayerControls: function () {
        let layerControlList = document.getElementById("layers");
        layerControlList.innerHTML = "";
    },

    addColorControl: function (color) {
        let colorControl = document.createElement("div");
        colorControl.innerHTML = "<div class='color-preview' style='background-color: " + color.hex + "'></div><div class='color-visibility'>&#9673;</div><div class='color-text'>" + color.hex + "</div>";
        colorControl.classList.add("visible");
        colorControl.addEventListener("click", function () {
            color.visible = !color.visible;

            if (color.visible) {
                colorControl.classList.add("visible");
            } else {
                colorControl.classList.remove("visible");
            }
            if (color.visible) {
                delete this.colorReplacements[color.hex];
            } else {
                this.colorReplacements[color.hex] = '#00000000';
            }

            this.render();
        }.bind(this));
        let colorControlList = document.getElementById("colors");
        colorControlList.append(colorControl);
    },

    mouseDownHandler: function (e) {
        this.pos = {
            left: this.canvas.offsetLeft,
            top: this.canvas.offsetTop,
            x: e.clientX,
            y: e.clientY,
        };
        this.canvas.style.cursor = 'grabbing';
        this.canvas.style.userSelect = 'none';
        this.mouseMoveHandle = this.mouseMoveHandler.bind(this);
        this.mouseUpHandle = this.mouseUpHandler.bind(this);
        document.addEventListener('mousemove', this.mouseMoveHandle);
        document.addEventListener('mouseup', this.mouseUpHandle);
    },

    mouseMoveHandler: function (e) {
        const dx = e.clientX - this.pos.x;
        const dy = e.clientY - this.pos.y;
        this.canvas.style.left = (this.pos.left + dx) + 'px';
        this.canvas.style.top = (this.pos.top + dy) + 'px';
    },

    mouseUpHandler: function (e) {
        document.removeEventListener('mousemove', this.mouseMoveHandle);
        document.removeEventListener('mouseup', this.mouseUpHandle);
        this.canvas.style.cursor = 'grab';
        this.canvas.style.removeProperty('user-select');
    }


}
