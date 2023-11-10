"use strict";
import {
    APIGatewayProxyEvent,
    APIGatewayProxyEventV2,
    APIGatewayProxyResult,
    Context,
} from "aws-lambda";

type ExecutionContent = {
    statusCode: Number | String;
    resBody: Object | String;
    startedAt: Date;
    finishedAt: Date;
    observations: Array<Object>;
};

function log(
    event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
    executionContent: ExecutionContent,
) {
    const date1_ms = executionContent.startedAt.getTime();
    const date2_ms = executionContent.finishedAt.getTime();

    const executionTime = Number.isFinite(date2_ms - date1_ms)
        ? date2_ms - date1_ms
        : 0;

    const logExt = {
        event,
        response: {
            statusCode: executionContent.statusCode,
            body: executionContent.resBody,
        },
        executionTime,
        observations: executionContent.observations,
        metadata: {
            libraryType: "Lambda wrapper",
            libraryVersion: "1.0.1",
            libraryLanguage: "JavaScript",
        },
    };

    console.log(
        "firetail:log-ext:" +
            Buffer.from(JSON.stringify(logExt)).toString("base64"),
    );
}

function wrap(next: Function & { then?: Function }) {
    return (
        event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
        context: Context,
    ) => {
        const startedAt = new Date();
        const observations: Array<Object> = [];

        let workInProgress;
        if (
            next.constructor.name === "Promise" ||
            next.constructor.name === "AsyncFunction"
        ) {
            workInProgress = next(event, context, () => {});
        } else if (typeof next === "function") {
            workInProgress = Promise.resolve(next(event, context, () => {}));
            observations.push({
                type: "firetail.configuration.synchronous.handler.detected",
                title: "The wrapper has been called with a synchronous function",
            });
        } else {
            workInProgress = Promise.resolve(next);
            observations.push({
                type: "firetail.configuration.no.handler.detected",
                title: "The wrapper has been called with an invalid argument",
            });
        }

        return workInProgress.then((result: APIGatewayProxyResult) => {
            const { body, statusCode } = result;
            const finishedAt = new Date();

            log(event, {
                statusCode: statusCode || 200,
                resBody: body,
                startedAt,
                finishedAt,
                observations,
            });
            return result;
        });
    };
}

export = wrap;
