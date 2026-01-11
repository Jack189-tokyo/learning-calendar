"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function (o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function () { return m[k]; } });
}) : (function (o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function (o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function (o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LcapContainer = void 0;
require("reflect-metadata");
const hooks_1 = require("./hooks");
const inversify_1 = require("inversify");
const utils = __importStar(require("./utils"));
const config_service_1 = require("./services/config/config.service");
const logger_service_1 = require("./services/logger/logger.service");
const err_service_1 = require("./services/err/err.service");
const tcb_service_1 = require("./services/tcb/tcb.service");
const tcloud_request_service_1 = require("./services/tcloud-request/tcloud-request.service");
const cloud_file_service_1 = require("./services/cloud-file/cloud-file.service");
const promise_pool_service_1 = require("./services/promise-pool/promise-pool.service");
const context_types_1 = require("./services/context/context.types");
const word_service_1 = require("./services/word/word.service");
const weda_request_service_1 = require("./services/weda-request/weda-request.service");
hooks_1.beforeBootstrap();
/**
 * 低码行业模板通用容器
 */
class LcapContainer {
    constructor(params) {
        this.ioc = new inversify_1.Container();
        this.ioc.bind(context_types_1.LC_DATASOURCE_CTX_TYPE).toConstantValue(params === null || params === void 0 ? void 0 : params.lcDatasourceCtx);
        this.ioc.bind(logger_service_1.LoggerService).toSelf()
            .inSingletonScope();
        this.ioc.bind(err_service_1.ErrService).toSelf()
            .inSingletonScope();
        this.ioc.bind(config_service_1.ConfigService).toSelf()
            .inSingletonScope();
        this.ioc.bind(tcb_service_1.TcbService).toSelf()
            .inSingletonScope();
        this.ioc.bind(tcloud_request_service_1.TcloudRequestService).toSelf()
            .inSingletonScope();
        this.ioc.bind(cloud_file_service_1.CloudFileService).toSelf()
            .inSingletonScope();
        this.ioc.bind(promise_pool_service_1.PromisePoolService).toSelf()
            .inSingletonScope();
        this.ioc.bind(word_service_1.WordService).toSelf()
            .inSingletonScope();
        this.ioc.bind(weda_request_service_1.WedaRequestService).toSelf()
            .inSingletonScope();
    }
    /**
     * 获取公共 Service，提供数据源开发常用工具
     */
    get services() {
        return {
            utilService: utils,
            loggerService: this.ioc.resolve(logger_service_1.LoggerService),
            errService: this.ioc.resolve(err_service_1.ErrService),
            configService: this.ioc.resolve(config_service_1.ConfigService),
            tcbService: this.ioc.resolve(tcb_service_1.TcbService),
            tcloudRequestService: this.ioc.resolve(tcloud_request_service_1.TcloudRequestService),
            cloudFileService: this.ioc.resolve(cloud_file_service_1.CloudFileService),
            promisePoolService: this.ioc.resolve(promise_pool_service_1.PromisePoolService),
            wordService: this.ioc.resolve(word_service_1.WordService),
            wedaRequestService: this.ioc.resolve(weda_request_service_1.WedaRequestService),
        };
    }
}
exports.LcapContainer = LcapContainer;
