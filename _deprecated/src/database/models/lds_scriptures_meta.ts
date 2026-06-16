import { DataTypes, Sequelize } from 'sequelize';
import ModelBase from './ModelBase'; // Assuming you have a base model class

export default class _lds_scriptures_meta extends ModelBase {
    id: any;
    version: any;
    book_id: any;
    verse_id: any;
    type: any;
    text: any;
    style: any;
    footer: any;
    seq: any;
    prev_id: any;
    level: any;

    public static initModel(sequelize: Sequelize): typeof _lds_scriptures_meta {
        this.init({
            id: {
                type: DataTypes.STRING(255),
                allowNull: false,
                primaryKey: true,
            },
            version: {
                type: DataTypes.STRING(255),
                allowNull: false,
            },
            book_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                defaultValue: 0,
            },
            verse_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            type: {
                type: DataTypes.STRING(255),
                allowNull: false,
            },
            text: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            style: {
                type: DataTypes.STRING(255),
                allowNull: false,
                defaultValue: '',
            },
            footer: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            seq: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            prev_id: {
                type: DataTypes.STRING(255),
                allowNull: true,
            },
            level: {
                type: DataTypes.INTEGER,
                allowNull: true,
                defaultValue: 0,
            },
        }, {
            sequelize,
            tableName: 'lds_scriptures_meta',
            timestamps: false,
            indexes: [
                {
                    name: 'id',
                    using: 'BTREE',
                    fields: ['id'],
                },
                {
                    name: 'version',
                    using: 'BTREE',
                    fields: ['version'],
                },
                {
                    name: 'verse_id',
                    using: 'BTREE',
                    fields: ['verse_id'],
                },
                {
                    name: 'book_id',
                    using: 'BTREE',
                    fields: ['book_id'],
                },
            ],
        });
        
        return this;
    }
}